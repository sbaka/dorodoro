"use client";

import { useEffect, useState } from "react";
import { off, onValue, ref } from "firebase/database";

import { useAuth } from "@/app/components/auth-provider";
import { getFirebaseDatabase } from "@/lib/firebase/database";
import type { CompletedSessionRecord } from "@/lib/analytics/completed-sessions";
import type { LoadedSession } from "@/lib/analytics/kpis";

type Status = "loading" | "ready" | "error";

export type UseCompletedSessionsResult = {
  sessions: LoadedSession[];
  status: Status;
  error: Error | null;
};

export function useCompletedSessions(): UseCompletedSessionsResult {
  const { user, status: authStatus } = useAuth();
  const [sessions, setSessions] = useState<LoadedSession[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (authStatus === "loading") return;
    const uid = user?.uid;
    if (!uid) {
      setSessions([]);
      setStatus("ready");
      return;
    }

    setStatus("loading");
    setError(null);

    const db = getFirebaseDatabase();
    const entries = ref(db, `users/${uid}/completedSessions`);

    const unsubscribe = onValue(
      entries,
      (snap) => {
        const raw = (snap.val() ?? {}) as Record<string, CompletedSessionRecord>;
        const list: LoadedSession[] = Object.entries(raw).map(([id, value]) => ({
          id,
          ...value,
        }));
        setSessions(list);
        setStatus("ready");
      },
      (err) => {
        console.error("Failed to subscribe to completed sessions:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      },
    );

    return () => {
      off(entries);
      unsubscribe();
    };
  }, [user?.uid, authStatus]);

  return { sessions, status, error };
}
