import { NextResponse } from "next/server";

import { RequestAuthError, verifyRequestUser } from "@/lib/auth/server-request";
import {
  getWorkerSecret,
  getWorkerUrl,
  normalizeChatBody,
  parseJsonBody,
} from "@/app/api/ai/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";

  try {
    await verifyRequestUser(request);
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Invalid account token." }, { status: 401 });
  }

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const normalized = normalizeChatBody(parsed.body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: authHeader,
  };
  const workerSecret = getWorkerSecret();
  if (workerSecret) {
    headers["X-Dorodoro-Worker-Secret"] = workerSecret;
  }

  try {
    const workerResp = await fetch(getWorkerUrl("/chat"), {
      method: "POST",
      headers,
      body: JSON.stringify(normalized.payload),
      cache: "no-store",
      signal: request.signal,
    });

    if (!workerResp.body) {
      const text = await workerResp.text().catch(() => "");
      return new Response(text || JSON.stringify({ error: "worker_unavailable" }), {
        status: workerResp.status,
        headers: {
          "Content-Type": workerResp.headers.get("Content-Type") ?? "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(workerResp.body, {
      status: workerResp.status,
      headers: {
        "Content-Type": workerResp.headers.get("Content-Type") ?? "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("[ai-chat] worker request failed", error);
    return NextResponse.json({ error: "AI worker unavailable." }, { status: 502 });
  }
}
