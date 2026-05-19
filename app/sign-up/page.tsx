import Image from "next/image";

import { GuestOnly } from "@/app/components/auth-guard";
import { SiteHeader } from "@/app/components/site-header";
import { SignupForm } from "@/app/components/signup-form";

export default function Page() {
  return (
    <GuestOnly>
      <div className="page-frame">
        <SiteHeader mode="public" active="signup" />

        <main className="auth-page">
          <div className="auth-page-shell">
            <section className="auth-hero">
              <div className="auth-hero-copy">
                <p className="auth-eyebrow">Start here</p>
                <h1>Build a study routine that feels easier to keep.</h1>
                <p className="auth-lead">
                  Create an account, start your timer, and use Pomodoro sessions to turn
                  long study plans into smaller blocks you can actually finish.
                </p>
              </div>

              <div className="auth-hero-highlights">
                <div className="auth-highlight-card">
                  <strong>Clear structure</strong>
                  <span>One session at a time, one break at a time.</span>
                </div>
                <div className="auth-highlight-card">
                  <strong>Better consistency</strong>
                  <span>A routine that is easier to repeat every day.</span>
                </div>
              </div>

              <div className="auth-visual-card">
                <Image
                  src="/assets/joinUS.png"
                  alt="DoroDoro mascot welcoming new users"
                  width={420}
                  height={420}
                />
              </div>
            </section>

            <section className="auth-card signUpContainer">
              <div className="form-head">
                <p className="form-tag">Create account</p>
                <h2>Set up your study space.</h2>
              </div>

              <SignupForm />
            </section>
          </div>
        </main>
      </div>
    </GuestOnly>
  );
}