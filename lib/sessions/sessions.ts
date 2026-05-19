import {
  get,
  onValue,
  push,
  ref,
  set,
  update,
  type Unsubscribe,
} from "firebase/database";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type WorkspaceSession = {
  id: string;
  title: string;
  description: string;
  status: "active" | "paused" | "done";
  createdAt: number;
  updatedAt: number;
  archivedAt: number;
};

function sanitizeTitle(raw: unknown): string {
  const title = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  return title || "Untitled session";
}

function normalize(id: string, raw: unknown): WorkspaceSession {
  const base = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const statusValue = base.status;
  const status: WorkspaceSession["status"] =
    statusValue === "paused" || statusValue === "done" ? statusValue : "active";

  return {
    id,
    title: sanitizeTitle(base.title),
    description:
      typeof base.description === "string" ? base.description.slice(0, 300) : "",
    status,
    createdAt: Number(base.createdAt) || 0,
    updatedAt: Number(base.updatedAt) || 0,
    archivedAt: Number(base.archivedAt) || 0,
  };
}

function isWorkspaceRecord(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const record = raw as Record<string, unknown>;
  return Boolean(
    typeof record.title === "string" ||
      typeof record.status === "string" ||
      record.createdAt !== undefined ||
      record.updatedAt !== undefined ||
      record.focusBoard ||
      record.aiChat,
  );
}

export function subscribeToSessions(
  uid: string,
  onList: (list: WorkspaceSession[]) => void,
): Unsubscribe {
  const listRef = ref(getFirebaseDatabase(), `users/${uid}/sessions`);
  return onValue(listRef, (snap) => {
    const raw = (snap.val() ?? {}) as Record<string, unknown>;
    const list = Object.keys(raw)
      .filter((id) => isWorkspaceRecord(raw[id]))
      .map((id) => normalize(id, raw[id]))
      .filter((session) => !session.archivedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    onList(list);
  });
}

export function subscribeToActiveSessionId(
  uid: string,
  onActive: (id: string) => void,
): Unsubscribe {
  const activeRef = ref(getFirebaseDatabase(), `users/${uid}/activeSessionId`);
  return onValue(activeRef, (snap) => {
    const value = snap.val();
    onActive(typeof value === "string" ? value : "");
  });
}

export async function createSession(uid: string, title: string): Promise<WorkspaceSession> {
  const db = getFirebaseDatabase();
  const listRef = ref(db, `users/${uid}/sessions`);
  const now = Date.now();
  const entry = push(listRef);
  const record = {
    title: sanitizeTitle(title),
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };

  await set(entry, record);
  await set(ref(db, `users/${uid}/activeSessionId`), entry.key);

  return {
    id: entry.key!,
    description: "",
    archivedAt: 0,
    ...record,
  };
}

export async function renameSession(uid: string, id: string, title: string): Promise<void> {
  const now = Date.now();
  await update(ref(getFirebaseDatabase(), `users/${uid}/sessions/${id}`), {
    title: sanitizeTitle(title),
    updatedAt: now,
  });
}

export async function archiveSession(uid: string, id: string): Promise<void> {
  const now = Date.now();
  await update(ref(getFirebaseDatabase(), `users/${uid}/sessions/${id}`), {
    archivedAt: now,
    status: "done" as const,
    updatedAt: now,
  });
}

export async function setActiveSession(uid: string, id: string): Promise<void> {
  await set(ref(getFirebaseDatabase(), `users/${uid}/activeSessionId`), id);
}

export async function ensureDefaultSession(uid: string): Promise<string> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, `users/${uid}/sessions`));
  const raw = (snap.val() ?? {}) as Record<string, unknown>;

  const existingIds = Object.keys(raw).filter((id) => isWorkspaceRecord(raw[id]));
  if (existingIds.length > 0) {
    const activeSnap = await get(ref(db, `users/${uid}/activeSessionId`));
    const current = activeSnap.val();
    if (typeof current === "string" && existingIds.includes(current)) {
      return current;
    }
    await set(ref(db, `users/${uid}/activeSessionId`), existingIds[0]);
    return existingIds[0];
  }

  const created = await createSession(uid, "Default");
  return created.id;
}
