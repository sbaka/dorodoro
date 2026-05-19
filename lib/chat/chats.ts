import {
  get,
  off,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

function chatsPath(uid: string, sessionId: string): string {
  return `users/${uid}/sessions/${sessionId}/aiChat/chats`;
}

function chatPath(uid: string, sessionId: string, chatId: string): string {
  return `${chatsPath(uid, sessionId)}/${chatId}`;
}

function activeChatIdPath(uid: string, sessionId: string): string {
  return `users/${uid}/sessions/${sessionId}/aiChat/activeChatId`;
}

function legacyMessagesPath(uid: string, sessionId: string): string {
  return `users/${uid}/sessions/${sessionId}/aiChat/messages`;
}

export function subscribeToChats(
  uid: string,
  sessionId: string,
  onData: (chats: ChatThread[]) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirebaseDatabase();
  const chatsRef = ref(db, chatsPath(uid, sessionId));
  const unsubscribe = onValue(
    chatsRef,
    (snap) => {
      const raw = (snap.val() ?? {}) as Record<string, Omit<ChatThread, "id"> & { messages?: unknown }>;
      const list = Object.entries(raw)
        .map(([id, { title, createdAt, updatedAt }]) => ({ id, title, createdAt, updatedAt }))
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      onData(list);
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  );
  return () => {
    off(chatsRef);
    unsubscribe();
  };
}

export function subscribeToActiveChatId(
  uid: string,
  sessionId: string,
  onData: (chatId: string | null) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirebaseDatabase();
  const activeRef = ref(db, activeChatIdPath(uid, sessionId));
  const unsubscribe = onValue(
    activeRef,
    (snap) => {
      const value = snap.val();
      onData(typeof value === "string" ? value : null);
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  );
  return () => {
    off(activeRef);
    unsubscribe();
  };
}

export async function createChat(
  uid: string,
  sessionId: string,
  title: string,
  makeActive = true,
): Promise<ChatThread> {
  const db = getFirebaseDatabase();
  const now = Date.now();
  const entry = push(ref(db, chatsPath(uid, sessionId)));
  const chatId = entry.key ?? "";
  const payload = {
    title: title.trim().slice(0, 80) || "New chat",
    createdAt: now,
    updatedAt: now,
  };
  await set(entry, payload);
  if (makeActive) {
    await set(ref(db, activeChatIdPath(uid, sessionId)), chatId);
  }
  return { id: chatId, ...payload };
}

export async function renameChat(
  uid: string,
  sessionId: string,
  chatId: string,
  title: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, chatPath(uid, sessionId, chatId)), {
    title: title.trim().slice(0, 80) || "Untitled chat",
    updatedAt: Date.now(),
  });
}

export async function deleteChat(
  uid: string,
  sessionId: string,
  chatId: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, chatPath(uid, sessionId, chatId)));
}

export async function setActiveChat(
  uid: string,
  sessionId: string,
  chatId: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await set(ref(db, activeChatIdPath(uid, sessionId)), chatId);
}

/**
 * Ensures at least one chat exists for the session. Migrates legacy
 * aiChat/messages into a "Current chat" if found. Returns the active chat ID.
 */
export async function ensureDefaultChat(
  uid: string,
  sessionId: string,
): Promise<string> {
  const db = getFirebaseDatabase();

  const chatsSnap = await get(ref(db, chatsPath(uid, sessionId)));
  if (chatsSnap.exists()) {
    const activeSnap = await get(ref(db, activeChatIdPath(uid, sessionId)));
    if (activeSnap.exists()) {
      return activeSnap.val() as string;
    }
    const raw = chatsSnap.val() as Record<string, { updatedAt?: number }>;
    const sorted = Object.entries(raw).sort(
      ([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );
    const firstId = sorted[0][0];
    await set(ref(db, activeChatIdPath(uid, sessionId)), firstId);
    return firstId;
  }

  const legacySnap = await get(ref(db, legacyMessagesPath(uid, sessionId)));
  if (legacySnap.exists()) {
    const entry = push(ref(db, chatsPath(uid, sessionId)));
    const chatId = entry.key ?? "";
    const now = Date.now();
    await set(entry, {
      title: "Current chat",
      createdAt: now,
      updatedAt: now,
      messages: legacySnap.val(),
    });
    await remove(ref(db, legacyMessagesPath(uid, sessionId)));
    await set(ref(db, activeChatIdPath(uid, sessionId)), chatId);
    return chatId;
  }

  const chat = await createChat(uid, sessionId, "New chat", true);
  return chat.id;
}
