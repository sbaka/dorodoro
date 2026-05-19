import { get, ref, set } from "firebase/database";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type Preferences = {
    weeklyGoal: number;
    soundNotifications: boolean;
    assistantStarterPrompts: boolean;
    analyticsConsent: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
    weeklyGoal: 20,
    soundNotifications: true,
    assistantStarterPrompts: true,
    analyticsConsent: false,
};

const PREFERENCES_PATH = "preferences";
const PREFERENCES_CACHE_KEY = "dorodoro.preferences";

function preferencesRefPath(uid: string) {
    return `users/${uid}/${PREFERENCES_PATH}`;
}

function isPreferencesLike(value: unknown): value is Partial<Record<keyof Preferences, unknown>> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizePreferences(raw: unknown): Preferences {
    const base = isPreferencesLike(raw) ? raw : {};
    return {
        weeklyGoal: normalizeNumber(base.weeklyGoal, DEFAULT_PREFERENCES.weeklyGoal, 4, 56),
        soundNotifications: normalizeBoolean(
            base.soundNotifications,
            DEFAULT_PREFERENCES.soundNotifications,
        ),
        assistantStarterPrompts: normalizeBoolean(
            base.assistantStarterPrompts,
            DEFAULT_PREFERENCES.assistantStarterPrompts,
        ),
        analyticsConsent: normalizeBoolean(
            base.analyticsConsent,
            DEFAULT_PREFERENCES.analyticsConsent,
        ),
    };
}

export async function loadPreferences(uid: string): Promise<Preferences> {
    const db = getFirebaseDatabase();
    const snapshot = await get(ref(db, preferencesRefPath(uid)));
    return snapshot.exists() ? normalizePreferences(snapshot.val()) : { ...DEFAULT_PREFERENCES };
}

export async function savePreferences(uid: string, next: Preferences): Promise<void> {
    const db = getFirebaseDatabase();
    await set(ref(db, preferencesRefPath(uid)), normalizePreferences(next));
}

export function readCachedPreferences(): Preferences | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(PREFERENCES_CACHE_KEY);
        if (!raw) {
            return null;
        }
        return normalizePreferences(JSON.parse(raw));
    } catch {
        window.localStorage.removeItem(PREFERENCES_CACHE_KEY);
        return null;
    }
}

export function writeCachedPreferences(preferences: Preferences): void {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(preferences));
}