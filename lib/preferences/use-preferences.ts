"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import {
    DEFAULT_PREFERENCES,
    loadPreferences,
    readCachedPreferences,
    savePreferences,
    writeCachedPreferences,
    type Preferences,
} from "@/lib/preferences/preferences";

export type PreferencesStatus = "loading" | "ready" | "error";

export type UsePreferencesResult = {
    preferences: Preferences;
    status: PreferencesStatus;
    error: string | null;
    save: (next: Preferences) => Promise<void>;
    isSaving: boolean;
};

export function usePreferences(): UsePreferencesResult {
    const { user, status: authStatus } = useAuth();
    const [preferences, setPreferences] = useState<Preferences>(
        () => readCachedPreferences() ?? { ...DEFAULT_PREFERENCES },
    );
    const [status, setStatus] = useState<PreferencesStatus>(
        readCachedPreferences() ? "ready" : "loading",
    );
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (authStatus === "loading") {
            return;
        }

        if (!user) {
            setPreferences({ ...DEFAULT_PREFERENCES });
            setStatus("ready");
            setError(null);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const next = await loadPreferences(user.uid);
                if (cancelled) return;
                setPreferences(next);
                writeCachedPreferences(next);
                setStatus("ready");
                setError(null);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to load preferences:", err);
                setStatus("error");
                setError("Could not load your additional preferences. Try refreshing the page.");
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [authStatus, user]);

    const save = useCallback(
        async (next: Preferences) => {
            if (!user) {
                throw new Error("Cannot save preferences while signed out.");
            }

            setIsSaving(true);
            setError(null);

            try {
                await savePreferences(user.uid, next);
                setPreferences(next);
                writeCachedPreferences(next);
            } catch (err) {
                console.error("Failed to save preferences:", err);
                setError("Could not save your preferences. Try again in a moment.");
                throw err;
            } finally {
                setIsSaving(false);
            }
        },
        [user],
    );

    return { preferences, status, error, save, isSaving };
}