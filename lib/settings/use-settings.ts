"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  readCachedSettings,
  saveSettings,
  writeCachedSettings,
  type Settings,
} from "@/lib/settings/settings";

export type SettingsStatus = "loading" | "ready" | "error";

export type UseSettingsResult = {
  settings: Settings;
  status: SettingsStatus;
  error: string | null;
  save: (next: Settings) => Promise<void>;
  isSaving: boolean;
};

export function useSettings(): UseSettingsResult {
  const { user, status: authStatus } = useAuth();
  const [settings, setSettings] = useState<Settings>(
    () => readCachedSettings() ?? { ...DEFAULT_SETTINGS },
  );
  const [status, setStatus] = useState<SettingsStatus>(
    readCachedSettings() ? "ready" : "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (authStatus === "loading") {
      return;
    }

    if (!user) {
      setSettings({ ...DEFAULT_SETTINGS });
      setStatus("ready");
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const next = await loadSettings(user.uid);
        if (cancelled) return;
        setSettings(next);
        writeCachedSettings(next);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load settings:", err);
        setStatus("error");
        setError("Could not load your settings. Try refreshing the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, user]);

  const save = useCallback(
    async (next: Settings) => {
      if (!user) {
        throw new Error("Cannot save settings while signed out.");
      }

      setIsSaving(true);
      setError(null);

      try {
        await saveSettings(user.uid, next);
        setSettings(next);
        writeCachedSettings(next);
      } catch (err) {
        console.error("Failed to save settings:", err);
        setError("Could not save your settings. Try again in a moment.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [user],
  );

  return { settings, status, error, save, isSaving };
}
