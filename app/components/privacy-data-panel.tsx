"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/lib/preferences/use-preferences";

type Notice = { tone: "error" | "success" | "info"; text: string } | null;

export function PrivacyDataPanel() {
    const router = useRouter();
    const { user, signOutUser } = useAuth();
    const { preferences, save, isSaving } = usePreferences();
    const [notice, setNotice] = useState<Notice>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const canManageData = useMemo(() => Boolean(user), [user]);

    async function authHeader() {
        const token = await user?.getIdToken();
        if (!token) {
            throw new Error("You need to be signed in to manage account data.");
        }
        return { Authorization: `Bearer ${token}` };
    }

    async function handleExport() {
        if (!canManageData || isExporting) {
            return;
        }

        setIsExporting(true);
        setNotice(null);

        try {
            const response = await fetch("/api/account/export", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await authHeader()),
                },
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(typeof payload?.error === "string" ? payload.error : "Export failed.");
            }

            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `dorodoro-data-${user?.uid ?? "account"}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);

            setNotice({ tone: "success", text: "Your export is ready and downloading now." });
        } catch (error) {
            setNotice({
                tone: "error",
                text: error instanceof Error ? error.message : "Could not export your data.",
            });
        } finally {
            setIsExporting(false);
        }
    }

    async function handleDelete() {
        if (!canManageData || isDeleting) {
            return;
        }

        setIsDeleting(true);
        setNotice(null);

        try {
            const response = await fetch("/api/account/delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(await authHeader()),
                },
                body: JSON.stringify({ confirm: "DELETE" }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(typeof payload?.error === "string" ? payload.error : "Delete failed.");
            }

            await signOutUser();
            router.push("/");
        } catch (error) {
            setNotice({
                tone: "error",
                text: error instanceof Error ? error.message : "Could not delete your account.",
            });
            setIsDeleting(false);
        }
    }

    async function toggleAnalyticsConsent(next: boolean) {
        setNotice(null);
        try {
            await save({ ...preferences, analyticsConsent: next });
            setNotice({
                tone: "success",
                text: next
                    ? "Analytics consent preference saved. Tracking still stays off until analytics is actually enabled in the app."
                    : "Analytics consent preference removed.",
            });
        } catch {
            setNotice({ tone: "error", text: "Could not update analytics consent." });
        }
    }

    return (
        <div className="settings-pane-stack">
            <section className="settings-double-grid">
                <article className="settings-info-card surface-card">
                    <p className="dash-eyebrow">GDPR</p>
                    <h3>Privacy and data controls</h3>
                    <p>
                        Export, deletion, and consent controls now live inside settings so they are reachable
                        from the same place as the rest of the account setup.
                    </p>

                    {notice ? (
                        <p
                            role={notice.tone === "error" ? "alert" : "status"}
                            className={`settings-notice settings-notice--${notice.tone}`}
                        >
                            {notice.text}
                        </p>
                    ) : null}

                    <div className="settings-switch-stack">
                        <label className="settings-switch-row" htmlFor="privacy-analytics-consent">
                            <div>
                                <span className="field-label">Analytics consent</span>
                                <small>
                                    This app currently uses functional storage and Firebase auth. Keep this off unless
                                    non-essential analytics are turned on later.
                                </small>
                            </div>
                            <input
                                id="privacy-analytics-consent"
                                className="settings-switch-input"
                                type="checkbox"
                                checked={preferences.analyticsConsent}
                                disabled={isSaving}
                                onChange={(event) => void toggleAnalyticsConsent(event.target.checked)}
                            />
                        </label>
                    </div>
                </article>

                <article className="settings-info-card surface-card">
                    <p className="dash-eyebrow">Public docs</p>
                    <h3>Retention and legal copy</h3>
                    <p>
                        The public Privacy and Terms pages explain what is stored, how long it stays around, and
                        how account deletion works from the signed-in settings experience.
                    </p>
                    <div className="settings-link-list">
                        <a href="/privacy" className="secondary-pill">Privacy policy</a>
                        <a href="/terms" className="secondary-pill">Terms of service</a>
                    </div>
                </article>
            </section>

            <section className="settings-double-grid">
                <article className="settings-info-card surface-card">
                    <p className="dash-eyebrow">Export</p>
                    <h3>Download your account data</h3>
                    <p>
                        The export includes account metadata, settings, preferences, sessions, notes, todos,
                        completed session logs, stats, and saved AI chat messages.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleExport()}
                        disabled={!canManageData || isExporting}
                    >
                        <Download className="size-4" aria-hidden="true" />
                        {isExporting ? "Preparing export..." : "Download JSON export"}
                    </Button>
                </article>

                <article className="settings-info-card surface-card">
                    <p className="dash-eyebrow">Delete account</p>
                    <h3>Remove account and stored data</h3>
                    <p>
                        This removes your Firebase account and the account data saved under your user record. It
                        cannot be undone.
                    </p>

                    <AlertDialog>
                        <AlertDialogTrigger
                            render={
                                <Button variant="destructive">
                                    <Trash2 className="size-4" aria-hidden="true" />
                                    Delete account
                                </Button>
                            }
                        />
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete your DoroDoro account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Your settings, notes, todos, analytics history, and saved assistant chats will be
                                    removed. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void handleDelete()} disabled={isDeleting}>
                                    {isDeleting ? "Deleting..." : "Delete forever"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </article>
            </section>
        </div>
    );
}