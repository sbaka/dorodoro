"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AssistantUsagePanel } from "@/app/components/assistant-usage-panel";
import { EditProfileModal } from "@/app/components/edit-profile-modal";
import { PreferencesPanel } from "@/app/components/preferences-panel";
import { ProfileCard } from "@/app/components/profile-card";
import { PrivacyDataPanel } from "@/app/components/privacy-data-panel";
import { SettingsForm } from "@/app/components/settings-form";
import { useAuth } from "@/app/components/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMinutes, computeKpis } from "@/lib/analytics/kpis";
import { useCompletedSessions } from "@/lib/analytics/use-completed-sessions";
import { isGoogleUser } from "@/lib/auth/access";
import { useSettings } from "@/lib/settings/use-settings";

const ABOUT_IMAGES = [
    { src: "/assets/Happy tomato.png", alt: "Happy tomato mascot" },
    { src: "/assets/cerise.png", alt: "Cherry mascot" },
    { src: "/assets/Strong_pepper.png", alt: "Pepper mascot" },
    { src: "/assets/joinUS.png", alt: "Welcome illustration" },
];

function parseGoal(raw: string | undefined): number {
    const parsed = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

function providerSummary(user: ReturnType<typeof useAuth>["user"]): string {
    if (!user) {
        return "Signed out";
    }
    const hasGoogle = isGoogleUser(user);
    const hasPassword = user.providerData.some((provider) => provider?.providerId === "password");
    if (hasGoogle && hasPassword) {
        return "Google and password";
    }
    if (hasGoogle) {
        return "Google account";
    }
    return hasPassword ? "Email and password" : "Email link";
}

export function SettingsHub() {
    const { user, status } = useAuth();
    const { settings, status: settingsStatus } = useSettings();
    const { sessions, status: sessionsStatus } = useCompletedSessions();
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

    const goal = parseGoal(settings["Daily Goal"]);
    const kpis = useMemo(() => computeKpis(sessions, goal), [sessions, goal]);

    const isLoading = status === "loading" || settingsStatus === "loading" || sessionsStatus === "loading";
    const goalRemaining = Math.max(kpis.goal - kpis.todayPomos, 0);
    const goalProgress = kpis.goal > 0 ? Math.min(100, Math.round((kpis.todayPomos / kpis.goal) * 100)) : 0;
    const isAuthenticated = status === "authenticated" && Boolean(user);
    const canAddPassword = Boolean(user?.providerData.some((provider) => provider?.providerId === "password") === false);

    return (
        <div className="settings-hub">
            <section className="settings-hero surface-card">
                <div className="settings-hero-copy">
                    <p className="dash-eyebrow">Personalize your focus system</p>
                    <h1>Settings</h1>
                    <p>
                        Keep account, timer rhythm, goals, privacy, and product guidance in one place.
                        Changes stay tied to your account so the workspace feels the same on every device.
                    </p>
                </div>

                <div className="settings-hero-actions">
                    <Link href="/privacy" className="secondary-pill">
                        Privacy
                    </Link>
                    <Link href="/terms" className="secondary-pill">
                        Terms
                    </Link>
                    <Link href="/start" className="primary-pill">
                        Back to focus
                    </Link>
                </div>
            </section>

            <section className="settings-overview-grid">
                <article className="settings-metric-card surface-card">
                    <p className="dash-eyebrow">Today</p>
                    <h2>{isLoading ? "Loading..." : `${kpis.todayPomos}/${kpis.goal} pomos`}</h2>
                    <p>
                        {isLoading
                            ? "Pulling your latest sessions."
                            : goalRemaining === 0
                                ? "Daily goal already cleared."
                                : `${goalRemaining} more to close today.`}
                    </p>
                    <div className="settings-progress-track" aria-hidden="true">
                        <span style={{ width: `${goalProgress}%` }} />
                    </div>
                </article>

                <article className="settings-metric-card surface-card">
                    <p className="dash-eyebrow">Account</p>
                    <h2>{providerSummary(user)}</h2>
                    <p>
                        {user
                            ? user.emailVerified || isGoogleUser(user)
                                ? "Ready for synced settings, exports, and account actions."
                                : "Verify your email to keep access active."
                            : "Sign in to unlock account controls."}
                    </p>
                    <ul className="settings-chip-list">
                        <li>{user?.email ?? "No email"}</li>
                        <li>{user?.emailVerified || isGoogleUser(user) ? "Verified" : "Needs verification"}</li>
                    </ul>
                </article>

                <article className="settings-metric-card surface-card">
                    <p className="dash-eyebrow">All-time focus</p>
                    <h2>{isLoading ? "Loading..." : formatMinutes(kpis.allTimeFocusMin)}</h2>
                    <p>
                        {isLoading
                            ? "Building your history summary."
                            : `${kpis.sessionsCompleted} completed session${kpis.sessionsCompleted === 1 ? "" : "s"} across the workspace.`}
                    </p>
                    <ul className="settings-chip-list">
                        <li>{kpis.currentStreak} day streak</li>
                        <li>{kpis.allTimePomos} pomos logged</li>
                    </ul>
                </article>
            </section>

            <Tabs defaultValue="focus" className="settings-tabs">
                <TabsList variant="line" className="settings-tabs-list mb-3 mt-6 h-auto! min-h-[2.6rem]" aria-label="Settings sections">
                    <TabsTrigger value="focus" className="settings-tabs-trigger">Focus and goals</TabsTrigger>
                    <TabsTrigger value="account" className="settings-tabs-trigger">Account</TabsTrigger>
                    <TabsTrigger value="assistant" className="settings-tabs-trigger">Assistant usage</TabsTrigger>
                    <TabsTrigger value="privacy" className="settings-tabs-trigger">Privacy and data</TabsTrigger>
                    <TabsTrigger value="about" className="settings-tabs-trigger">About</TabsTrigger>
                </TabsList>

                <TabsContent value="focus">
                    <div className="settings-tab-grid">
                        <section className="settings-container surface-card">
                            <SettingsForm />
                        </section>

                        <aside className="settings-side-stack">
                            <PreferencesPanel />
                        </aside>
                    </div>
                </TabsContent>

                <TabsContent value="account">
                    <div className="settings-pane-stack">
                        <ProfileCard />
                        <EditProfileModal open={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} />

                        <section className="settings-double-grid">
                            <article className="settings-info-card surface-card">
                                <p className="dash-eyebrow">Security</p>
                                <h3>Password and sign-in</h3>
                                <p>
                                    Use the same profile flow to update your email, add an email-password sign-in to
                                    eligible accounts, or change an existing password without leaving settings.
                                </p>
                                <ul className="settings-bullet-list">
                                    <li>Provider: {providerSummary(user)}</li>
                                    <li>Status: {user?.emailVerified || isGoogleUser(user) ? "Verified access" : "Verification pending"}</li>
                                    <li>
                                        {isAuthenticated
                                            ? canAddPassword
                                                ? "Add a password here so you can sign in with email and password too."
                                                : "Use your current password to confirm sensitive account changes."
                                            : "Sign in first to manage your email address and password."}
                                    </li>
                                </ul>
                                <div className="settings-link-list">
                                    {isAuthenticated ? (
                                        <button
                                            type="button"
                                            className="primary-pill"
                                            onClick={() => setIsAccountModalOpen(true)}
                                        >
                                            {canAddPassword ? "Add password sign-in" : "Manage email and password"}
                                        </button>
                                    ) : (
                                        <Link href="/login" className="primary-pill">
                                            Sign in with email
                                        </Link>
                                    )}
                                </div>
                            </article>
                        </section>
                    </div>
                </TabsContent>

                <TabsContent value="assistant">
                    <div className="settings-pane-stack">
                        <AssistantUsagePanel />

                    </div>
                </TabsContent>

                <TabsContent value="privacy">
                    <div id="privacy-data">
                        <PrivacyDataPanel />
                    </div>
                </TabsContent>

                <TabsContent value="about">
                    <div className="settings-pane-stack">
                        <article className="settings-info-card surface-card">
                            <p className="dash-eyebrow">About DoroDoro</p>
                            <h3>Short focus blocks, softer pacing, and a cleaner workspace.</h3>
                            <p>
                                The original static site is being moved into Next route by route. Marketing, auth,
                                dashboard, timer, and settings already share the same shell. Bringing About into
                                settings makes the product story sit next to the account and privacy controls that
                                support it.
                            </p>
                        </article>

                        <div className="about-mini-grid">
                            {ABOUT_IMAGES.map((image) => (
                                <div key={image.src} className="about-mini-card surface-card">
                                    <Image src={image.src} alt={image.alt} width={180} height={180} />
                                </div>
                            ))}
                        </div>

                        <article className="settings-info-card surface-card">
                            <p className="dash-eyebrow">Public version</p>
                            <h3>Keep a lighter About page too</h3>
                            <p>
                                The public About route stays available for visitors, but the richer signed-in version
                                now lives here so the app feels connected once someone has an account.
                            </p>
                            <div className="settings-link-list">
                                <Link href="/about" className="secondary-pill">Open public About</Link>
                            </div>
                        </article>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}