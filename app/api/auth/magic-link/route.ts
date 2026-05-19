import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase/admin";
import {
  getMagicLinkFromAddress,
  getResendClient,
  renderMagicLinkEmail,
} from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

function getContinueUrl(request: Request): string {
  const explicit = process.env.MAGIC_LINK_CONTINUE_URL;
  if (explicit) return explicit;

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return new URL("/login", origin).toString();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email.trim()
      : "";

  if (!email || !emailPattern.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 },
    );
  }

  try {
    const adminAuth = getAdminAuth();
    const continueUrl = getContinueUrl(request);

    const signInLink = await adminAuth.generateSignInWithEmailLink(email, {
      url: continueUrl,
      handleCodeInApp: true,
    });

    const resend = getResendClient();
    const from = getMagicLinkFromAddress();
    const { subject, html, text } = renderMagicLinkEmail({
      email,
      signInLink,
    });

    const result = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error("[magic-link] resend error", result.error);
      return NextResponse.json(
        { error: "Could not send the magic link right now. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[magic-link] failed", error);
    return NextResponse.json(
      { error: "Could not send the magic link right now. Try again." },
      { status: 500 },
    );
  }
}
