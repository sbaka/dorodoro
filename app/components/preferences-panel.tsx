"use client";

import { useEffect, useMemo, useState } from "react";

import type { Preferences } from "@/lib/preferences/preferences";
import { usePreferences } from "@/lib/preferences/use-preferences";

type Notice = { tone: "error" | "success" | "info"; text: string } | null;

function clampWeeklyGoal(value: number): number {
    return Math.min(56, Math.max(4, Math.round(value)));
}

export function PreferencesPanel() {
    const { preferences, status, error, save, isSaving } = usePreferences();
    const [draft, setDraft] = useState<Preferences>(preferences);
    const [notice, setNotice] = useState<Notice>(null);
    const isLoading = status === "loading";

    useEffect(() => {
        setDraft(preferences);
    }, [preferences]);

    useEffect(() => {
        if (error) {
            setNotice({ tone: "error", text: error });
        }
    }, [error]);

    const isDirty = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(preferences),
        [draft, preferences],
    );

    function updateBoolean<K extends keyof Preferences>(key: K, value: Preferences[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
        setNotice(null);
    }

    async function handleSave() {
        if (!isDirty || isSaving) {
            return;
        }

        setNotice(null);
        try {
            await save(draft);
            setNotice({ tone: "success", text: "Extra preferences saved." });
        } catch {
            setNotice({ tone: "error", text: "Could not save your extra preferences." });
        }
    }

    function handleReset() {
        setDraft(preferences);
        setNotice({ tone: "info", text: "Unsaved changes cleared." });
    }

    return (
        <article className="settings-info-card surface-card">
            <p className="dash-eyebrow">More options</p>
            <h3>Goals, reminders, and assistant defaults</h3>
            <p>
                These preferences sit next to the core timer controls so the settings page feels like one
                connected workspace instead of isolated forms.
            </p>

            {notice ? (
                <p
                    role={notice.tone === "error" ? "alert" : "status"}
                    className={`settings-notice settings-notice--${notice.tone}`}
                >
                    {notice.text}
                </p>
            ) : null}

            <label className="setting-item" htmlFor="weeklyGoal">
                <span className="field-label">Weekly Pomodoro Goal</span>
                <input
                    id="weeklyGoal"
                    type="range"
                    min="4"
                    max="56"
                    value={draft.weeklyGoal}
                    disabled={isLoading}
                    onChange={(event) =>
                        setDraft((current) => ({
                            ...current,
                            weeklyGoal: clampWeeklyGoal(Number(event.target.value)),
                        }))
                    }
                />
                <span className="range-readout">{draft.weeklyGoal} pomos / week</span>
                <small>Use this as a higher-level target above your daily streak.</small>
            </label>

            <div className="settings-switch-stack">
                <label className="settings-switch-row" htmlFor="pref-sound">
                    <div>
                        <span className="field-label">Alarm sound and desktop alerts</span>
                        <small>Use the same alert preference in the timer and settings page.</small>
                    </div>
                    <input
                        id="pref-sound"
                        className="settings-switch-input"
                        type="checkbox"
                        checked={draft.soundNotifications}
                        disabled={isLoading}
                        onChange={(event) => updateBoolean("soundNotifications", event.target.checked)}
                    />
                </label>

                <label className="settings-switch-row" htmlFor="pref-starters">
                    <div>
                        <span className="field-label">Assistant starter prompts</span>
                        <small>Show or hide the quick prompt buttons in a fresh AI chat.</small>
                    </div>
                    <input
                        id="pref-starters"
                        className="settings-switch-input"
                        type="checkbox"
                        checked={draft.assistantStarterPrompts}
                        disabled={isLoading}
                        onChange={(event) => updateBoolean("assistantStarterPrompts", event.target.checked)}
                    />
                </label>
            </div>

            <div className="settings-actions">
                <button
                    type="button"
                    className="primary-pill"
                    onClick={() => void handleSave()}
                    disabled={!isDirty || isSaving || isLoading}
                >
                    {isSaving ? "Saving..." : "Save extra settings"}
                </button>
                <button
                    type="button"
                    className="secondary-pill"
                    onClick={handleReset}
                    disabled={!isDirty || isSaving || isLoading}
                >
                    Reset changes
                </button>
            </div>
        </article>
    );
}