"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import {
  archiveSession,
  createSession,
  ensureDefaultSession,
  renameSession,
  setActiveSession,
  subscribeToActiveSessionId,
  subscribeToSessions,
  type WorkspaceSession,
} from "@/lib/sessions/sessions";

export type UseSessionsResult = {
  sessions: WorkspaceSession[];
  active: WorkspaceSession | null;
  activeId: string;
  status: "loading" | "ready" | "error";
  error: string | null;
  create: (title: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
};

export function useSessions(): UseSessionsResult {
  const { user, status: authStatus } = useAuth();
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!user) {
      setSessions([]);
      setActiveId("");
      setStatus("ready");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await ensureDefaultSession(user.uid);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to ensure default session:", err);
        setError("Could not load your sessions. Try refreshing the page.");
        setStatus("error");
        return;
      }

      if (cancelled) return;
      setStatus("ready");
    })();

    const unsubscribeList = subscribeToSessions(user.uid, (next) => {
      setSessions(next);
    });

    const unsubscribeActive = subscribeToActiveSessionId(user.uid, (id) => {
      setActiveId(id);
    });

    return () => {
      cancelled = true;
      unsubscribeList();
      unsubscribeActive();
    };
  }, [authStatus, user]);

  const create = useCallback(
    async (title: string) => {
      if (!user) return;
      await createSession(user.uid, title);
    },
    [user],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      if (!user) return;
      await renameSession(user.uid, id, title);
    },
    [user],
  );

  const archive = useCallback(
    async (id: string) => {
      if (!user) return;
      await archiveSession(user.uid, id);
    },
    [user],
  );

  const setActive = useCallback(
    async (id: string) => {
      if (!user) return;
      await setActiveSession(user.uid, id);
    },
    [user],
  );

  const active = sessions.find((session) => session.id === activeId) ?? null;

  return {
    sessions,
    active,
    activeId,
    status,
    error,
    create,
    rename,
    archive,
    setActive,
  };
}
