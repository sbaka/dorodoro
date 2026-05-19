import {
  off,
  onValue,
  orderByChild,
  push,
  query,
  limitToLast,
  ref,
  set,
  update,
} from "firebase/database";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

function messagesPath(uid: string, sessionId: string, chatId: string): string {
  return `users/${uid}/sessions/${sessionId}/aiChat/chats/${chatId}/messages`;
}

export function subscribeToChatMessages(
  uid: string,
  sessionId: string,
  chatId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirebaseDatabase();
  const messagesRef = ref(db, messagesPath(uid, sessionId, chatId));
  const q = query(messagesRef, orderByChild("createdAt"), limitToLast(50));
  const unsubscribe = onValue(
    q,
    (snap) => {
      const raw = (snap.val() ?? {}) as Record<
        string,
        Omit<ChatMessage, "id">
      >;
      const list = Object.entries(raw)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      onData(list);
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  );
  return () => {
    off(messagesRef);
    unsubscribe();
  };
}

export async function pushUserMessage(
  uid: string,
  sessionId: string,
  chatId: string,
  content: string,
): Promise<ChatMessage> {
  const db = getFirebaseDatabase();
  const now = Date.now();
  const entry = push(ref(db, messagesPath(uid, sessionId, chatId)));
  const payload: Omit<ChatMessage, "id"> = {
    role: "user",
    content,
    createdAt: now,
  };
  await set(entry, payload);
  await update(
    ref(db, `users/${uid}/sessions/${sessionId}/aiChat/chats/${chatId}`),
    { updatedAt: now },
  );
  return { id: entry.key ?? "", ...payload };
}
