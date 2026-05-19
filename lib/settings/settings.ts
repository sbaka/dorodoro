import { get, ref, set } from "firebase/database";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type SettingKey =
  | "Pomo Duration"
  | "Short Break Duration"
  | "Long Break Duration"
  | "Number Of Pomos"
  | "Long Break Interval"
  | "Daily Goal";

export type Settings = Record<SettingKey, string>;

export const DEFAULT_SETTINGS: Settings = {
  "Pomo Duration": "25",
  "Short Break Duration": "5",
  "Long Break Duration": "20",
  "Number Of Pomos": "4",
  "Long Break Interval": "2",
  "Daily Goal": "4",
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

const SETTINGS_PATH = "settings";
const SETTINGS_CACHE_KEY = "settings";

function settingsRefPath(uid: string) {
  return `users/${uid}/${SETTINGS_PATH}`;
}

function isSettingsLike(value: unknown): value is Partial<Record<string, unknown>> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeSettings(raw: unknown): Settings {
  const base = isSettingsLike(raw) ? raw : {};
  const next = { ...DEFAULT_SETTINGS };

  for (const key of SETTING_KEYS) {
    const value = base[key];
    if (value !== undefined && value !== null) {
      next[key] = String(value);
    }
  }

  return next;
}

function readLegacySettings(raw: unknown): Partial<Settings> | null {
  if (!isSettingsLike(raw)) {
    return null;
  }

  const picked: Partial<Settings> = {};
  for (const key of SETTING_KEYS) {
    const value = raw[key];
    if (value !== undefined && value !== null) {
      picked[key] = String(value);
    }
  }

  return Object.keys(picked).length ? picked : null;
}

export async function loadSettings(uid: string): Promise<Settings> {
  const db = getFirebaseDatabase();
  const snapshot = await get(ref(db, settingsRefPath(uid)));

  if (snapshot.exists()) {
    return normalizeSettings(snapshot.val());
  }

  // Fall back to the legacy root-of-user shape and migrate it forward.
  const legacySnapshot = await get(ref(db, `users/${uid}`));
  const legacy = readLegacySettings(legacySnapshot.val());

  if (legacy) {
    const migrated = normalizeSettings(legacy);
    try {
      await set(ref(db, settingsRefPath(uid)), migrated);
    } catch {
      // Non-fatal: we still return the migrated values to the caller.
    }
    return migrated;
  }

  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(uid: string, next: Settings): Promise<void> {
  const db = getFirebaseDatabase();
  await set(ref(db, settingsRefPath(uid)), next);
}

export function readCachedSettings(): Settings | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeSettings(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(SETTINGS_CACHE_KEY);
    return null;
  }
}

export function writeCachedSettings(settings: Settings): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
}
