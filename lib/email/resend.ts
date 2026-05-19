import "server-only";

import { Resend } from "resend";

let cached: Resend | null = null;

export function getResendClient(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  cached = new Resend(apiKey);
  return cached;
}

export function getMagicLinkFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. Use a verified Resend sender (e.g. \"DoroDoro <login@yourdomain.com>\").",
    );
  }
  return from;
}

type TemplateInput = {
  email: string;
  signInLink: string;
  appName?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMagicLinkEmail({
  email,
  signInLink,
  appName = "DoroDoro",
}: TemplateInput) {
  const subject = `Your ${appName} sign-in link`;
  const text = [
    `Hi,`,
    ``,
    `Use the link below to sign in to ${appName} as ${email}.`,
    `Jump back into your next focus block with a one-time link that expires shortly.`,
    ``,
    signInLink,
    ``,
    `Quick reminders:`,
    `- This link only works once.`,
    `- If it expires, request a fresh one from the login page.`,
    ``,
    `If you did not request this, you can ignore this email.`,
  ].join("\n");

  const safeAppName = escapeHtml(appName);
  const safeEmail = escapeHtml(email);
  const safeLink = escapeHtml(signInLink);
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#fdf8ef;color:#1a1a2e;font-family:'Trebuchet MS','Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
      Use your one-time DoroDoro sign-in link and get back into your next focus block.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background-color:#fdf8ef;background-image:radial-gradient(circle, rgba(26,26,46,0.08) 1px, transparent 1px);background-size:26px 26px;">
      <tr>
        <td align="center" style="padding:24px 16px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;">
            <tr>
              <td style="padding:0 0 14px 4px;font-size:26px;line-height:1;font-weight:700;color:#d92828;">
                ${safeAppName}
              </td>
            </tr>
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border:2px solid #1a1a2e;border-radius:24px 24px 0 0;background:linear-gradient(180deg, #1a1a2e 0%, #23253f 100%);">
                  <tr>
                    <td style="padding:32px 30px 28px;color:#ffffff;">
                      <div style="display:inline-block;margin:0 0 16px;padding:8px 14px;border:2px solid #1a1a2e;border-radius:999px;background:#f5c428;color:#1a1a2e;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                        Magic link
                      </div>
                      <h1 style="margin:0 0 12px;font-size:34px;line-height:1.1;color:#ffffff;">
                        Continue your study flow.
                      </h1>
                      <p style="margin:0;font-size:16px;line-height:1.7;color:rgba(255,255,255,0.86);">
                        Use this one-time link to sign in as <strong>${safeEmail}</strong> and jump back into your next focus block without extra friction.
                      </p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border:2px solid #1a1a2e;border-top:none;border-radius:0 0 24px 24px;background:linear-gradient(180deg, rgba(255,255,255,0.97) 0%, #ffffff 100%);">
                  <tr>
                    <td style="padding:28px 30px 32px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 22px;">
                        <tr>
                          <td style="padding:0 8px 0 0;vertical-align:top;">
                            <div style="padding:14px 16px;border:2px solid #1a1a2e;border-radius:16px;background:#fdeaea;color:#a81f1f;font-size:14px;line-height:1.55;">
                              <strong style="display:block;margin:0 0 4px;color:#1a1a2e;">Works once</strong>
                              This sign-in link is single-use for extra safety.
                            </div>
                          </td>
                          <td style="padding:0 0 0 8px;vertical-align:top;">
                            <div style="padding:14px 16px;border:2px solid #1a1a2e;border-radius:16px;background:#fef9e6;color:#1a1a2e;font-size:14px;line-height:1.55;">
                              <strong style="display:block;margin:0 0 4px;color:#1a1a2e;">Expires soon</strong>
                              If it times out, request a fresh link from the login page.
                            </div>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                        <tr>
                          <td align="center" style="border:2px solid #1a1a2e;border-radius:999px;background:#d92828;box-shadow:3px 3px 0 #1a1a2e;">
                            <a href="${safeLink}" style="display:inline-block;padding:14px 22px;font-size:15px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;">
                              Sign in to ${safeAppName}
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5a5a72;">
                        Button not working? Paste this URL into your browser:
                      </p>
                      <div style="margin:0 0 24px;padding:14px 16px;border:2px dashed #1a1a2e;border-radius:16px;background:#fdf8ef;font-size:13px;line-height:1.6;word-break:break-all;color:#1a1a2e;">
                        <a href="${safeLink}" style="color:#d92828;text-decoration:none;">${safeLink}</a>
                      </div>
                      <p style="margin:0;font-size:13px;line-height:1.65;color:#5a5a72;">
                        If you did not request this email, you can safely ignore it.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
