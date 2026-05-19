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

export type BoardColumnType = "notes" | "todos";

export type BoardColumn = {
  id: string;
  title: string;
  type: BoardColumnType;
  order: number;
  createdAt: number;
  updatedAt: number;
};

function columnsPath(uid: string, sessionId: string): string {
  return `users/${uid}/sessions/${sessionId}/board/columns`;
}

function columnPath(uid: string, sessionId: string, columnId: string): string {
  return `${columnsPath(uid, sessionId)}/${columnId}`;
}

function sanitizeTitle(value: string, type: BoardColumnType): string {
  const t = value.trim().slice(0, 40);
  if (t) return t;
  return type === "todos" ? "Todo column" : "Notes column";
}

function normalizeColumn(id: string, raw: unknown, index: number): BoardColumn {
  const base = (raw ?? {}) as Partial<BoardColumn>;
  const type: BoardColumnType = base.type === "todos" ? "todos" : "notes";
  return {
    id,
    type,
    title: sanitizeTitle(typeof base.title === "string" ? base.title : "", type),
    order: Number.isFinite(base.order) ? Number(base.order) : index,
    createdAt: Number(base.createdAt) || Date.now(),
    updatedAt: Number(base.updatedAt) || Date.now(),
  };
}

export function subscribeToColumns(
  uid: string,
  sessionId: string,
  onData: (cols: BoardColumn[]) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, columnsPath(uid, sessionId));
  const unsub = onValue(
    r,
    (snap) => {
      const raw = (snap.val() ?? {}) as Record<string, unknown>;
      const cols = Object.entries(raw)
        .map(([id, value], index) => normalizeColumn(id, value, index))
        .sort((a, b) => a.order - b.order);
      onData(cols);
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  );
  return () => {
    off(r);
    unsub();
  };
}

export async function loadColumnsOnce(
  uid: string,
  sessionId: string,
): Promise<BoardColumn[]> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, columnsPath(uid, sessionId)));
  const raw = (snap.val() ?? {}) as Record<string, unknown>;
  return Object.entries(raw)
    .map(([id, value], index) => normalizeColumn(id, value, index))
    .sort((a, b) => a.order - b.order);
}

export async function createColumn(
  uid: string,
  sessionId: string,
  options: { title: string; type: BoardColumnType; order: number },
): Promise<BoardColumn> {
  const db = getFirebaseDatabase();
  const now = Date.now();
  const entry = push(ref(db, columnsPath(uid, sessionId)));
  const col: Omit<BoardColumn, "id"> = {
    title: sanitizeTitle(options.title, options.type),
    type: options.type,
    order: options.order,
    createdAt: now,
    updatedAt: now,
  };
  await set(entry, col);
  return { id: entry.key ?? "", ...col };
}

export async function renameColumn(
  uid: string,
  sessionId: string,
  columnId: string,
  title: string,
  type: BoardColumnType,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, columnPath(uid, sessionId, columnId)), {
    title: sanitizeTitle(title, type),
    updatedAt: Date.now(),
  });
}

export async function deleteColumn(
  uid: string,
  sessionId: string,
  columnId: string,
  type: BoardColumnType,
): Promise<void> {
  const db = getFirebaseDatabase();
  await Promise.all([
    remove(ref(db, columnPath(uid, sessionId, columnId))),
    remove(
      ref(
        db,
        `users/${uid}/sessions/${sessionId}/board/${type === "todos" ? "todos" : "notes"}/${columnId}`,
      ),
    ),
  ]);
}

export async function reorderColumns(
  uid: string,
  sessionId: string,
  orderedIds: string[],
): Promise<void> {
  const db = getFirebaseDatabase();
  const patch: Record<string, number> = {};
  orderedIds.forEach((id, index) => {
    patch[`${id}/order`] = index;
  });
  await update(ref(db, columnsPath(uid, sessionId)), patch);
}
