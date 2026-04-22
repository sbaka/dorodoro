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

const ACTION_BLOCK_RE = /<doro-action>\s*([\s\S]*?)\s*<\/doro-action>/i;

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

function extractAssistantPayload(text) {
  const rawText = typeof text === "string" ? text : "";
  const match = rawText.match(ACTION_BLOCK_RE);
  const visibleText = rawText.replace(ACTION_BLOCK_RE, "").trim();
  if (!match) {
    return { visibleText, action: null };
  }

  try {
    const parsed = JSON.parse(match[1]);
    return {
      visibleText,
      action: normalizeActionPayload(parsed),
    };
  } catch (err) {
    console.warn("action payload parse failed:", err.message);
    return { visibleText, action: null };
  }
}

function normalizeActionPayload(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(source.actions)
    ? source.actions
    : source.type
      ? [source]
      : [];

  const actions = items
    .map(normalizeAction)
    .filter(Boolean);

  return actions.length ? { actions } : null;
}

function normalizeAction(raw) {
  const action = raw && typeof raw === "object" ? raw : {};
  if (action.type === "create_note") {
    const title = cleanText(action.title, 80);
    const content = cleanText(action.content, 4000);
    if (!title && !content) return null;
    return {
      type: "create_note",
      title,
      content,
    };
  }

  if (action.type === "create_todo_list") {
    const title = cleanText(action.title, 80);
    const items = normalizeActionItems(action.items);
    if (!title && !items.length) return null;
    return {
      type: "create_todo_list",
      title,
      items,
    };
  }

  return null;
}

function normalizeActionItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const base = item && typeof item === "object"
        ? item
        : { text: item };
      const text = cleanText(base.text, 160);
      if (!text) return null;
      return {
        text,
        priority: normalizePriority(base.priority),
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function normalizePriority(value) {
  return value === "low" || value === "high" ? value : "medium";
}

function cleanText(value, maxLen) {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : "";
}

function inferFallbackAction(messages, assistantText) {
  const userText = getLastUserMessage(messages).trim();
  const visibleText = cleanAssistantVisibleText(assistantText);
  if (!userText || !visibleText) {
    return null;
  }

  if (looksLikeTodoRequest(userText)) {
    const items = extractTodoItems(visibleText);
    if (items.length) {
      return normalizeActionPayload({
        actions: [{
          type: "create_todo_list",
          title: inferTodoTitle(userText),
          items,
        }],
      });
    }
  }

  if (looksLikeNoteRequest(userText)) {
    const content = extractNoteContent(visibleText);
    if (content) {
      return normalizeActionPayload({
        actions: [{
          type: "create_note",
          title: inferNoteTitle(userText),
          content,
        }],
      });
    }
  }

  return null;
}

function getLastUserMessage(messages) {
  if (!Array.isArray(messages)) {
    return "";
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index];
    if (msg && msg.role === "user" && typeof msg.content === "string") {
      return msg.content;
    }
  }
  return "";
}

function cleanAssistantVisibleText(text) {
  return String(text || "")
    .replace(ACTION_BLOCK_RE, "")
    .replace(/^i(?:'| a)m\s+(?:creating|have created|created)\b.*$/gim, "")
    .replace(/^here (?:is|are)\b.*$/gim, "")
    .replace(/^i apologize\b.*$/gim, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeTodoRequest(text) {
  const value = String(text || "").toLowerCase();
  return /(create|make|add|build)\b/.test(value) && /(todo|to-do|to do|task list|tasks)\b/.test(value);
}

function looksLikeNoteRequest(text) {
  const value = String(text || "").toLowerCase();
  return /(create|make|add|write)\b/.test(value) && /\bnote\b/.test(value);
}

function inferNoteTitle(userText) {
  const raw = String(userText || "");
  const named = raw.match(/(?:called|named|titled)\s+['"]?([^'"\n.]+)['"]?/i);
  if (named && named[1]) {
    return cleanText(named[1], 80);
  }
  const explaining = raw.match(/note\s+(?:about|on|explaining)\s+(.+)/i);
  if (explaining && explaining[1]) {
    return cleanText(explaining[1].replace(/\bin\s+\d+\s+lines?\b/i, ""), 80) || "AI note";
  }
  return "AI note";
}

function inferTodoTitle(userText) {
  const raw = String(userText || "");
  const named = raw.match(/(?:called|named|titled)\s+['"]?([^'"\n.]+)['"]?/i);
  if (named && named[1]) {
    return cleanText(named[1], 80);
  }
  if (/learn/i.test(raw)) {
    return "Learning plan";
  }
  return "AI todo list";
}

function extractNoteContent(text) {
  const cleaned = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return cleanText(cleaned, 4000);
}

function extractTodoItems(text) {
  const lines = String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items = [];
  lines.forEach((line) => {
    let itemText = "";
    let match = line.match(/^\d+[.):-]?\s+(.+)$/);
    if (match) {
      itemText = match[1];
    } else {
      match = line.match(/^[-*+]\s+(.+)$/);
      if (match) {
        itemText = match[1];
      } else if (/^[A-Z][^\n:]{2,40}:\s+.+$/.test(line)) {
        itemText = line;
      }
    }

    itemText = cleanText(itemText, 160);
    if (itemText) {
      items.push({ text: itemText, priority: "medium" });
    }
  });

  return items.slice(0, 20);
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
      let actionPayload = null;
      let tokensIn = 0;
      let tokensOut = 0;
      let upstreamFailed = false;
      try {
        for await (const part of streamChat(env, { messages, context: safeContext })) {
          if (part.type === "delta") {
            assistantText += part.text;
            controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", text: part.text }) + "\n"));
          } else if (part.type === "done") {
            assistantText = typeof part.fullText === "string" ? part.fullText : assistantText;
            tokensIn = part.tokensIn || 0;
            tokensOut = part.tokensOut || 0;
          }
        }

        const parsed = extractAssistantPayload(assistantText);
        assistantText = parsed.visibleText || "";
        actionPayload = parsed.action || inferFallbackAction(messages, assistantText);
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
            encoder.encode(JSON.stringify({ type: "done", messageId: msgId, tokensIn, tokensOut, quota: limit.quota, action: actionPayload }) + "\n")
          );
        } catch (err) {
          console.warn("persist assistant failed:", err.message);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done", quota: limit.quota, action: actionPayload }) + "\n"));
        }
      } else if (!upstreamFailed) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done", quota: limit.quota, action: actionPayload }) + "\n"));
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
