import { NextResponse } from "next/server";

import { RequestAuthError, verifyRequestUser } from "@/lib/auth/server-request";
import { getWorkerSecret, getWorkerUrl } from "@/app/api/ai/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";

  try {
    await verifyRequestUser(request);
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Invalid account token." }, { status: 401 });
  }

  const headers: Record<string, string> = {
    Authorization: authHeader,
  };
  const workerSecret = getWorkerSecret();
  if (workerSecret) {
    headers["X-Dorodoro-Worker-Secret"] = workerSecret;
  }

  try {
    const workerResp = await fetch(getWorkerUrl("/quota"), {
      method: "GET",
      headers,
      cache: "no-store",
      signal: request.signal,
    });
    const text = await workerResp.text();

    return new Response(text, {
      status: workerResp.status,
      headers: {
        "Content-Type": workerResp.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("[ai-quota] worker request failed", error);
    return NextResponse.json({ error: "AI worker unavailable." }, { status: 502 });
  }
}
