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

export type TodoPriority = "low" | "medium" | "high";

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  order: number;
  createdAt: number;
  priority: TodoPriority;
};

function normalizePriority(value: unknown): TodoPriority {
  if (value === "low" || value === "high") return value;
  return "medium";
}

function todosPath(uid: string, sessionId: string, columnId?: string): string {
  if (columnId) {
    return `users/${uid}/sessions/${sessionId}/board/todos/${columnId}`;
  }
  return `users/${uid}/sessions/${sessionId}/todos`;
}

function todoItemPath(
  uid: string,
  sessionId: string,
  todoId: string,
  columnId?: string,
): string {
  return `${todosPath(uid, sessionId, columnId)}/${todoId}`;
}

export function subscribeToTodos(
  uid: string,
  sessionId: string,
  onData: (todos: TodoItem[]) => void,
  onError: (error: Error) => void,
  columnId?: string,
): () => void {
  const db = getFirebaseDatabase();
  const todosRef = ref(db, todosPath(uid, sessionId, columnId));
  const unsubscribe = onValue(
    todosRef,
    (snap) => {
      const raw = (snap.val() ?? {}) as Record<string, Omit<TodoItem, "id">>;
      const list = Object.entries(raw)
        .map(([id, value]) => ({
          id,
          ...value,
          priority: normalizePriority((value as { priority?: unknown }).priority),
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      onData(list);
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  );
  return () => {
    off(todosRef);
    unsubscribe();
  };
}

export async function createTodo(
  uid: string,
  sessionId: string,
  text: string,
  nextOrder: number,
  columnId?: string,
  priority: TodoPriority = "medium",
): Promise<TodoItem> {
  const db = getFirebaseDatabase();
  const now = Date.now();
  const entry = push(ref(db, todosPath(uid, sessionId, columnId)));
  const item: Omit<TodoItem, "id"> = {
    text: text.slice(0, 300).trim(),
    done: false,
    order: nextOrder,
    createdAt: now,
    priority: normalizePriority(priority),
  };
  await set(entry, item);
  return { id: entry.key ?? "", ...item };
}

export async function updateTodo(
  uid: string,
  sessionId: string,
  todoId: string,
  patch: Partial<Pick<TodoItem, "text" | "done" | "order" | "priority">>,
  columnId?: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, todoItemPath(uid, sessionId, todoId, columnId)), patch);
}

export async function deleteTodo(
  uid: string,
  sessionId: string,
  todoId: string,
  columnId?: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, todoItemPath(uid, sessionId, todoId, columnId)));
}

export async function loadTodosOnce(
  uid: string,
  sessionId: string,
  columnId?: string,
): Promise<TodoItem[]> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, todosPath(uid, sessionId, columnId)));
  const raw = (snap.val() ?? {}) as Record<string, Omit<TodoItem, "id">>;
  return Object.entries(raw)
    .map(([id, value]) => ({
      id,
      ...value,
      priority: normalizePriority((value as { priority?: unknown }).priority),
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function reorderTodos(
  uid: string,
  sessionId: string,
  orderedIds: string[],
  columnId?: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  const patch: Record<string, number> = {};
  orderedIds.forEach((id, index) => {
    patch[`${id}/order`] = index;
  });
  await update(ref(db, todosPath(uid, sessionId, columnId)), patch);
}
