import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/app/components/site-header";

export const metadata: Metadata = {
    title: "Terms",
    description:
        "DoroDoro terms of service covering account use, assistant usage, and service expectations.",
};

const sections = [
    {
        title: "Accounts",
        body:
            "You are responsible for the activity that happens through your DoroDoro account and for keeping access to your email or linked sign-in provider secure.",
        points: [
            "Use accurate account information and keep it up to date.",
            "Do not share access in a way that would expose another person’s private workspace data.",
            "If you lose access, use the available password, Google, or magic-link recovery path that matches your account.",
        ],
    },
    {
        title: "Acceptable use",
        body:
            "DoroDoro is a productivity workspace. Use it for lawful, non-abusive activity and avoid content or behavior that would harm the service or other people.",
        points: [
            "Do not try to abuse authentication, rate limits, or stored assistant conversations.",
            "Do not rely on the assistant for high-stakes decisions without checking important information yourself.",
            "Do not use the service to store unlawful or malicious material.",
        ],
    },
    {
        title: "Service expectations",
        body:
            "We may update the product as it evolves. Features can change, but the goal is to keep account controls, saved workspace data, and legal documentation aligned with the real product behavior.",
        points: [
            "The assistant can make mistakes or incomplete suggestions.",
            "Temporary outages or maintenance can affect access.",
            "Deleting your account removes your stored account data and ends access to the related workspace history.",
        ],
    },
];

export default function TermsPage() {
    return (
        <div className="page-frame">
            <SiteHeader mode="public" />

            <main className="about-page legal-page">
                <section className="legal-shell surface-card">
                    <div className="legal-hero">
                        <p className="dash-eyebrow">Terms of service</p>
                        <h1>Ground rules for using DoroDoro and its AI assistant.</h1>
                        <p>
                            These terms keep the account model, the assistant, and the stored workspace features
                            aligned with how the app behaves in practice.
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
                        <h2>Related pages</h2>
                        <p>
                            Privacy controls live in the signed-in settings page, and the privacy notice explains
                            what account and workspace data the product stores today.
                        </p>
                        <div className="settings-link-list">
                            <Link href="/privacy" className="secondary-pill">
                                Read privacy
                            </Link>
                            <Link href="/settings" className="secondary-pill">
                                Open settings
                            </Link>
                        </div>
                    </section>
                </section>
            </main>
        </div>
    );
}