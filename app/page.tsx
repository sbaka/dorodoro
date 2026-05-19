import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/app/components/site-header";

const stripItems = [
  "Stay focused",
  "Take real breaks",
  "Build momentum",
  "Beat procrastination",
  "Study smarter",
  "Get it done",
];

const steps = [
  {
    num: "01",
    title: "Pick your task",
    desc: "Open a session, add a note or todo with what you're working on. Keep it specific — one task per session works best.",
    badge: "Notes + Todos",
    badgeClass: "badge-red",
  },
  {
    num: "02",
    title: "Start the timer",
    desc: "Hit start and work until the timer rings. No distractions, no switching tabs. Just you and the task for 25 minutes.",
    badge: "25 min focus",
    badgeClass: "badge-blue",
  },
  {
    num: "03",
    title: "Take your break",
    desc: "Step away for 5 minutes. Stretch, drink water, breathe. After 4 rounds, take a longer 15-minute break. Then repeat.",
    badge: "5 min reset",
    badgeClass: "badge-green",
  },
];

const features = [
  { icon: "⏱️", iconClass: "feat-icon-red",    title: "Pomodoro Timer",  desc: "Animated countdown with session dots, skip and restart controls. Syncs your breaks automatically." },
  { icon: "📝", iconClass: "feat-icon-yellow",  title: "Notes & Todos",   desc: "Rich-text notes and prioritized todos, organized into tabs — all next to your timer." },
  { icon: "✨", iconClass: "feat-icon-green",   title: "AI Assistant",    desc: "Ask your session AI anything — summarize notes, suggest next steps, or just think out loud." },
  { icon: "🗂️", iconClass: "feat-icon-blue",   title: "Study Sessions",  desc: "Create separate sessions per subject or project. Switch between them without losing your work." },
];

export default function Page() {
  const doubled = [...stripItems, ...stripItems];

  return (
    <div className="page-frame">
      <SiteHeader mode="public" />

      <main>
        {/* ── HERO ── */}
        <section className="hero-panel">
          <article className="ContentSection">
            <div className="eyebrow">🍅 Built for students who mean business</div>

            <div className="textSection">
              <h1>
                Study with{" "}
                <span className="accent">focus.</span>
                <br />
                Actually{" "}
                <span className="accent-2">finish.</span>
              </h1>
              <p>
                DoroDoro breaks your study sessions into focused sprints with real breaks in
                between. Notes, todos, and an AI assistant — all in the same tab.
              </p>
            </div>

            <div className="hero-actions">
              <Link href="/sign-up" className="primary-pill">
                Get started free →
              </Link>
              <a href="#how-it-works" className="secondary-link">
                How it works
              </a>
            </div>

            <div className="hero-highlights" aria-label="Pomodoro at a glance">
              {[
                { val: "25 min", lbl: "Focus sprint" },
                { val: "5 min",  lbl: "Short break" },
                { val: "× 4",   lbl: "Then long break" },
                { val: "Free",   lbl: "Always" },
              ].map((s) => (
                <div key={s.lbl} className="highlight-card">
                  <span className="highlight-value">{s.val}</span>
                  <span className="highlight-label">{s.lbl}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="hero-visual">
            <div className="hero-note hero-note-top">
              <strong>Focus time — 2 of 4</strong>
              <span>Start sooner, drift less.</span>
            </div>

            <div className="hero-mascot-card">
              <Image
                src="/assets/Happy tomato.png"
                alt="Happy tomato mascot"
                width={420}
                height={420}
                priority
              />
            </div>

            <div className="hero-note hero-note-bottom">
              <strong>🎉 Session complete!</strong>
              <span>Take a well-earned break.</span>
            </div>
          </article>
        </section>

        {/* ── SCROLLING STRIP ── */}
        <div className="strip" aria-hidden="true">
          <div className="strip-track">
            {doubled.map((item, i) => (
              <span key={i} className="strip-item">
                {item} <span className="strip-sep">✦</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <section className="how-section" id="how-it-works">
          <div className="section-inner">
            <div className="section-label">How it works</div>
            <h2 className="section-title">
              A simple rhythm
              <br />
              for better studying.
            </h2>
            <div className="steps-grid">
              {steps.map((step) => (
                <div key={step.num} className="step-card">
                  <div className="step-num">{step.num}</div>
                  <div className="step-title">{step.title}</div>
                  <p className="step-desc">{step.desc}</p>
                  <span className={`step-badge ${step.badgeClass}`}>{step.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="features-section">
          <div className="section-inner">
            <div className="section-label">Features</div>
            <h2 className="section-title">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>
            <div className="features-grid">
              {features.map((f) => (
                <div key={f.title} className="feat-card">
                  <div className={`feat-icon ${f.iconClass}`}>{f.icon}</div>
                  <div className="feat-title">{f.title}</div>
                  <p className="feat-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="cta-section">
          <div className="cta-inner">
            <div>
              <h2 className="cta-headline">
                Ready to actually
                <br />
                get stuff done?
              </h2>
              <p className="cta-sub">
                Join students who stopped dreading their study sessions. Sign up in
                seconds — no credit card, no catch.
              </p>
              <Link href="/sign-up" className="btn-white">
                Start studying for free →
              </Link>
            </div>
            <Image
              src="/assets/Strong_pepper.png"
              alt="Strong pepper mascot cheering you on"
              width={220}
              height={220}
              className="cta-mascot"
            />
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="site-footer">
          <div className="footer-logo">
            <Image src="/assets/logo.png" alt="DoroDoro" width={28} height={28} />
            DoroDoro
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} DoroDoro — Built for students.</p>
          <nav className="footer-links">
            <Link href="/about">About</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/sign-up">Sign up</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
