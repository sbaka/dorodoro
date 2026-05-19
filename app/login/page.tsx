import Image from "next/image";

import { GuestOnly } from "@/app/components/auth-guard";
import { LoginForm } from "@/app/components/login-form";
import { SiteHeader } from "@/app/components/site-header";

export default function Page() {
  return (
    <GuestOnly>
      <div className="page-frame">
        <SiteHeader mode="public" active="login" />

        <main className="auth-page">
          <div className="auth-page-shell">
            <section className="auth-hero">
              <div className="auth-hero-copy">
                <p className="auth-eyebrow">Welcome back</p>
                <h1>Pick up your next focus block without losing momentum.</h1>
                <p className="auth-lead">
                  Get back to your timer, your study rhythm, and the work you already
                  started. DoroDoro keeps the session simple so your attention can stay on
                  the task.
                </p>
              </div>

              <div className="auth-hero-highlights">
                <div className="auth-highlight-card">
                  <strong>Short sessions</strong>
                  <span>Less pressure to start difficult work.</span>
                </div>
                <div className="auth-highlight-card">
                  <strong>Planned breaks</strong>
                  <span>More consistent energy through the day.</span>
                </div>
              </div>

              <div className="auth-visual-card">
                <Image
                  src="/assets/joinUS.png"
                  alt="DoroDoro mascot welcoming users"
                  width={420}
                  height={420}
                />
              </div>
            </section>

            <section className="auth-card signInContainer">
              <div className="form-head">
                <p className="form-tag">Sign in</p>
                <h2>Continue your study flow.</h2>
                <p className="form-subcopy">
                  Start with Google for the quickest return, or use your email if you want
                  a password or a magic link instead.
                </p>
              </div>

              <LoginForm />
            </section>
          </div>
        </main>
      </div>
    </GuestOnly>
  );
}