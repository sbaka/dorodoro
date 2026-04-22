// Entry point for the dorodoro-ai Cloudflare Worker.
// Routes:
//   POST /chat        — stream a Gemini reply for a session
//   GET  /quota       — fetch the caller's current rate-limit counts
//   OPTIONS *         — CORS preflight
//
// All routes require a Firebase ID token in the Authorization header.

import { verifyIdToken } from "./auth.js";
import * as rateLimit from "./rateLimit.js";
import { streamChat } from "./gemini.js";
import { rtdbGet, rtdbPush, rtdbPatch } from "./rtdb.js";

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, init = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}), ...extraHeaders },
  });
}

async function getUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await verifyIdToken(match[1], env);
  } catch (err) {
    console.warn("auth failed:", err.message);
    return null;
  }
}

async function handleChat(request, env) {
  const user = await getUser(request, env);
  if (!user) return json({ error: "unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const { sessionId, messages, context } = body || {};
  if (!sessionId || typeof sessionId !== "string") {
    return json({ error: "missing_sessionId" }, { status: 400 });
  }
  if (!Array.isArray(messages) || !messages.length) {
    return json({ error: "missing_messages" }, { status: 400 });
  }

  // Confirm the session belongs to the authenticated user.
  const sessionMeta = await rtdbGet(env, `users/${user.uid}/sessions/${sessionId}`);
  if (!sessionMeta) {
    return json({ error: "forbidden_session" }, { status: 403 });
  }

  const limit = await rateLimit.check(env, user.uid);
  if (!limit.ok) {
    return json(
      { error: "rate_limited", reason: limit.reason, retryAfter: limit.retryAfter || null, limit: limit.limit || null },
      { status: 429 }
    );
  }

  const safeContext = {
    sessionTitle: (context && context.sessionTitle) || sessionMeta.title || "Untitled session",
    sessionDescription: sessionMeta.description || "",
    stats: sessionMeta.stats || null,
    notes: (context && typeof context.notes === "string") ? context.notes.slice(0, 40000) : "",
    todos: Array.isArray(context && context.todos) ? context.todos.slice(0, 20) : [],
  };

  const encoder = new TextEncoder();
  const rs = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      let tokensIn = 0;
      let tokensOut = 0;
      let upstreamFailed = false;
      try {
        for await (const part of streamChat(env, { messages, context: safeContext })) {
          if (part.type === "delta") {
            assistantText += part.text;
            controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", text: part.text }) + "\n"));
          } else if (part.type === "done") {
            tokensIn = part.tokensIn || 0;
            tokensOut = part.tokensOut || 0;
          }
        }
      } catch (err) {
        upstreamFailed = true;
        console.warn("gemini failed:", err.message);
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", message: "AI unavailable" }) + "\n")
        );
        // Rollback counters on upstream 5xx so quota isn't burned.
        if (!err.status || err.status >= 500) {
          await rateLimit.rollback(env, limit.stamp).catch(() => {});
        }
      }

      // Persist the assistant message only on success.
      if (!upstreamFailed && assistantText) {
        try {
          const msgId = await rtdbPush(
            env,
            `users/${user.uid}/sessions/${sessionId}/aiChat/messages`,
            {
              role: "assistant",
              content: assistantText,
              createdAt: Date.now(),
              tokensIn,
              tokensOut,
            }
          );
          await rtdbPatch(env, `users/${user.uid}/sessions/${sessionId}/aiChat`, {
            updatedAt: Date.now(),
          });
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "done", messageId: msgId, tokensIn, tokensOut, quota: limit.quota }) + "\n")
          );
        } catch (err) {
          console.warn("persist assistant failed:", err.message);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done", quota: limit.quota }) + "\n"));
        }
      } else if (!upstreamFailed) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done", quota: limit.quota }) + "\n"));
      }

      controller.close();
    },
  });

  const origin = request.headers.get("Origin") || "";
  return new Response(rs, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(env, origin),
    },
  });
}

async function handleQuota(request, env) {
  const user = await getUser(request, env);
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const q = await rateLimit.quota(env, user.uid);
  const origin = request.headers.get("Origin") || "";
  return json(q, {}, corsHeaders(env, origin));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
    }

    try {
      if (url.pathname === "/chat" && request.method === "POST") {
        return await handleChat(request, env);
      }
      if (url.pathname === "/quota" && request.method === "GET") {
        return await handleQuota(request, env);
      }
      return json({ error: "not_found" }, { status: 404 }, corsHeaders(env, origin));
    } catch (err) {
      console.error("worker error:", err);
      return json({ error: "internal_error" }, { status: 500 }, corsHeaders(env, origin));
    }
  },
};
