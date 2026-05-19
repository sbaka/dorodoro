"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import { useSessions } from "@/lib/sessions/use-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTodo,
  deleteTodo,
  reorderTodos,
  subscribeToTodos,
  updateTodo,
  type TodoItem,
  type TodoPriority,
} from "@/lib/workspace/todos";

const PRIORITY_OPTIONS: TodoPriority[] = ["low", "medium", "high"];

function priorityClass(p: TodoPriority): string {
  return `todo-priority todo-priority--${p}`;
}

export function TodosList({ columnId }: { columnId?: string } = {}) {
  const { user } = useAuth();
  const { activeId } = useSessions();
  const uid = user?.uid ?? "";
  const sessionId = activeId;

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !sessionId) {
      setTodos([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    setError(null);
    const unsubscribe = subscribeToTodos(
      uid,
      sessionId,
      (list) => {
        setTodos(list);
        setStatus("ready");
      },
      (err) => {
        setError(err.message);
        setStatus("error");
      },
      columnId,
    );
    return unsubscribe;
  }, [uid, sessionId, columnId]);

  const nextOrder = useMemo(() => {
    if (!todos.length) return 0;
    return Math.max(...todos.map((t) => t.order ?? 0)) + 1;
  }, [todos]);

  const onAdd = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || !uid || !sessionId) return;
      setDraft("");
      try {
        await createTodo(uid, sessionId, text, nextOrder, columnId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [draft, uid, sessionId, nextOrder, columnId],
  );

  const onToggle = useCallback(
    async (todo: TodoItem) => {
      if (!uid || !sessionId) return;
      try {
        await updateTodo(uid, sessionId, todo.id, { done: !todo.done }, columnId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [uid, sessionId, columnId],
  );

  const onDelete = useCallback(
    async (todo: TodoItem) => {
      if (!uid || !sessionId) return;
      try {
        await deleteTodo(uid, sessionId, todo.id, columnId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [uid, sessionId, columnId],
  );

  const onPriorityChange = useCallback(
    async (todo: TodoItem, next: TodoPriority) => {
      if (!uid || !sessionId) return;
      try {
        await updateTodo(uid, sessionId, todo.id, { priority: next }, columnId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [uid, sessionId, columnId],
  );

  const onMove = useCallback(
    async (todo: TodoItem, direction: -1 | 1) => {
      if (!uid || !sessionId) return;
      const index = todos.findIndex((t) => t.id === todo.id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= todos.length) return;
      const next = todos.slice();
      [next[index], next[target]] = [next[target], next[index]];
      setTodos(next); // optimistic
      try {
        await reorderTodos(
          uid,
          sessionId,
          next.map((t) => t.id),
          columnId,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [uid, sessionId, todos, columnId],
  );

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div className="todos-list">
      <header className="todos-list-header">
        <h3>Todos</h3>
        <span className="todos-list-count">
          {status === "loading"
            ? "Loading…"
            : `${remaining} of ${todos.length} open`}
        </span>
      </header>

      {error ? (
        <p className="settings-notice settings-notice--error">{error}</p>
      ) : null}

      <form className="todos-add-form flex items-center gap-2" onSubmit={onAdd}>
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task"
          maxLength={300}
          aria-label="New todo"
          disabled={!uid || !sessionId}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!draft.trim() || !uid || !sessionId}
        >
          Add
        </Button>
      </form>

      {todos.length === 0 && status === "ready" ? (
        <p className="todos-empty">
          No todos yet. Add one above to get started.
        </p>
      ) : (
        <ul className="todos-items">
          {todos.map((todo, index) => (
            <li
              key={todo.id}
              className={`todos-item todo-item${todo.done ? " todos-item--done is-done" : ""} todo-priority-row todo-priority-row--${todo.priority}`}
            >
              <input
                type="checkbox"
                className="todo-item-check"
                checked={todo.done}
                onChange={() => onToggle(todo)}
                aria-label={`Mark ${todo.text} ${todo.done ? "incomplete" : "complete"}`}
              />
              <span className="todo-item-text flex-1 truncate">
                {todo.text}
              </span>
              <select
                className={priorityClass(todo.priority)}
                value={todo.priority}
                onChange={(e) =>
                  void onPriorityChange(todo, e.target.value as TodoPriority)
                }
                aria-label="Priority"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="todo-item-move flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => void onMove(todo, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ChevronUp className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => void onMove(todo, 1)}
                  disabled={index === todos.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDown className="size-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void onDelete(todo)}
                aria-label={`Delete ${todo.text}`}
                className="todos-item-delete"
              >
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
