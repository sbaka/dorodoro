import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/app/components/site-header";

export const metadata: Metadata = {
    title: "Privacy",
    description:
        "How DoroDoro stores account data, focus history, assistant chats, and privacy controls.",
};

const sections = [
    {
        title: "What we store",
        body:
            "DoroDoro stores the account details needed for sign-in, your timer settings, extra preferences, workspace sessions, notes, todos, completed-session analytics, and saved AI assistant messages attached to sessions.",
        points: [
            "Firebase Authentication keeps account identity, provider links, and email-verification state.",
            "Firebase Realtime Database stores settings, preferences, sessions, notes, todos, completed sessions, summary stats, and saved assistant chats.",
            "Local and session storage are used for functional behavior such as timer recovery, cached settings, and magic-link sign-in continuity.",
        ],
    },
    {
        title: "How we use it",
        body:
            "The stored data is used to run the product: sync your workspace across devices, keep your timer state coherent, power dashboards, and restore assistant conversations inside a focus session.",
        points: [
            "There is no separate billing or token-usage tracking for the assistant in the current product.",
            "Google sign-in uses Google as an authentication provider and inherits their account controls for that login method.",
            "Magic-link emails are sent through Resend only when you request sign-in access.",
        ],
    },
    {
        title: "Retention and control",
        body:
            "Your data stays attached to your account until you delete it. The settings page now includes export and delete-account actions so the control surface sits inside the product instead of outside it.",
        points: [
            "Use the in-app export action to download your account data as JSON.",
            "Use the delete-account action to remove your Firebase account and the user-owned data stored under your account record.",
            "Analytics consent remains off by default. The current app uses functional storage and auth, not active non-essential tracking.",
        ],
    },
];

export default function PrivacyPage() {
    return (
        <div className="page-frame">
            <SiteHeader mode="public" />

            <main className="about-page legal-page">
                <section className="legal-shell surface-card">
                    <div className="legal-hero">
                        <p className="dash-eyebrow">Privacy</p>
                        <h1>How DoroDoro handles your account and workspace data.</h1>
                        <p>
                            This page reflects the app as it exists today. It covers the data needed to run the
                            product, the storage used for account features, and the controls available from the
                            settings page.
                        </p>
                    </div>

                    <div className="legal-grid">
                        {sections.map((section) => (
                            <article key={section.title} className="surface-subcard legal-card">
                                <h2>{section.title}</h2>
                                <p>{section.body}</p>
                                <ul className="legal-list">
                                    {section.points.map((point) => (
                                        <li key={point}>{point}</li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>

                    <section className="surface-subcard legal-card">
                        <h2>Questions or requests</h2>
                        <p>
                            If you need help with a privacy request, use the contact address shown in your
                            DoroDoro account emails or the export and delete controls in settings when signed in.
                        </p>
                        <div className="settings-link-list">
                            <Link href="/settings" className="secondary-pill">
                                Open settings
                            </Link>
                            <Link href="/terms" className="secondary-pill">
                                Read terms
                            </Link>
                        </div>
                    </section>
                </section>
            </main>
        </div>
    );
}