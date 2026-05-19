"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";

import { useAuth } from "@/app/components/auth-provider";
import { useSessions } from "@/lib/sessions/use-sessions";
import {
  pushUserMessage,
  subscribeToChatMessages,
  type ChatMessage,
} from "@/lib/chat/messages";
import {
  createChat,
  deleteChat,
  ensureDefaultChat,
  renameChat,
  setActiveChat,
  subscribeToActiveChatId,
  subscribeToChats,
  type ChatThread,
} from "@/lib/chat/chats";

type Status = { text: string; tone: "info" | "error" } | null;

export type AiAction =
  | { type: "create_note"; title: string; content: string }
  | {
      type: "create_todo_list";
      title: string;
      items: { text: string; priority: "low" | "medium" | "high" }[];
    };

type StreamSignal =
  | { type: "delta"; text: string }
  | { type: "error"; message?: string }
  | { type: "done"; quota?: unknown; messageId?: string; action?: unknown };

export type UseSessionChatResult = {
  messages: ChatMessage[];
  streaming: string | null;
  status: Status;
  sending: boolean;
  send: (text: string) => Promise<void>;
  clearStatus: () => void;
  pendingActions: AiAction[];
  clearPendingActions: () => void;
  isReady: boolean;
  chats: ChatThread[];
  activeChatId: string | null;
  switchChat: (chatId: string) => Promise<void>;
  createNewChat: (title?: string) => Promise<void>;
  renameCurrentChat: (title: string) => Promise<void>;
  deleteChatById: (chatId: string) => Promise<void>;
};

function messageSignature(msg: { role: string; content: string; createdAt: number }) {
  return `${msg.role}|${msg.content}|${msg.createdAt}`;
}

async function parseError(resp: Response): Promise<string> {
  try {
    const data = (await resp.json()) as { error?: string; retryAfter?: number };
    if (resp.status === 429 && typeof data.retryAfter === "number") {
      const mins = Math.max(1, Math.ceil(data.retryAfter / 60));
      return `Rate limited. Try again in ~${mins} min.`;
    }
    return data.error || `Error ${resp.status}`;
  } catch {
    return `Error ${resp.status}`;
  }
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePriority(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "high" ? value : "medium";
}

function normalizeAiActions(value: unknown): AiAction[] {
  const source = value && typeof value === "object" ? value as { actions?: unknown } : {};
  if (!Array.isArray(source.actions)) return [];

  return source.actions
    .map((raw): AiAction | null => {
      const action = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      if (action.type === "create_note") {
        const title = cleanText(action.title, 80) || "AI note";
        const content = cleanText(action.content, 4000);
        return content ? { type: "create_note", title, content } : null;
      }

      if (action.type === "create_todo_list") {
        const title = cleanText(action.title, 80) || "AI todo list";
        const items = Array.isArray(action.items)
          ? action.items
              .map((item) => {
                const base: Record<string, unknown> = item && typeof item === "object"
                  ? item as Record<string, unknown>
                  : { text: item };
                const text = cleanText(base.text, 160);
                return text
                  ? { text, priority: normalizePriority(base.priority) }
                  : null;
              })
              .filter((item): item is { text: string; priority: "low" | "medium" | "high" } => item !== null)
              .slice(0, 20)
          : [];
        return items.length ? { type: "create_todo_list", title, items } : null;
      }

      return null;
    })
    .filter((action): action is AiAction => action !== null)
    .slice(0, 5);
}

export function useSessionChat(): UseSessionChatResult {
  const { user, status: authStatus } = useAuth();
  const { activeId } = useSessions();
  const uid = user?.uid ?? "";
  const sessionId = activeId;

  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<ChatMessage[]>([]);
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [sending, setSending] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [pendingActions, setPendingActions] = useState<AiAction[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  // Stable ref so send() always sees the latest chats without re-creating
  const chatsRef = useRef<ChatThread[]>([]);
  chatsRef.current = chats;

  // Effect 1: initialize chats and subscribe to chats list + activeChatId
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!uid || !sessionId) {
      setChats([]);
      setActiveChatId(null);
      setPersisted([]);
      setOptimistic([]);
      setIsReady(true);
      return;
    }

    setIsReady(false);
    setChats([]);
    setActiveChatId(null);
    setPersisted([]);
    setOptimistic([]);

    ensureDefaultChat(uid, sessionId).catch((err) => {
      console.warn("ensureDefaultChat failed:", err);
    });

    const unsubChats = subscribeToChats(
      uid,
      sessionId,
      (list) => setChats(list),
      (err) => setStatus({ text: err.message, tone: "error" }),
    );

    const unsubActive = subscribeToActiveChatId(
      uid,
      sessionId,
      (id) => setActiveChatId(id),
      (err) => setStatus({ text: err.message, tone: "error" }),
    );

    return () => {
      unsubChats();
      unsubActive();
    };
  }, [uid, sessionId, authStatus]);

  // Effect 2: subscribe to messages for the active chat
  useEffect(() => {
    if (!uid || !sessionId || !activeChatId) {
      setPersisted([]);
      setOptimistic([]);
      return;
    }

    setIsReady(false);
    const unsubscribe = subscribeToChatMessages(
      uid,
      sessionId,
      activeChatId,
      (list) => {
        setPersisted(list);
        setOptimistic((prev) =>
          prev.filter(
            (o) => !list.some((p) => messageSignature(p) === messageSignature(o)),
          ),
        );
        setIsReady(true);
      },
      (err) => {
        setStatus({ text: err.message, tone: "error" });
        setIsReady(true);
      },
    );
    return unsubscribe;
  }, [uid, sessionId, activeChatId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const messages = useMemo(() => {
    const merged = [...persisted];
    const seen = new Set(merged.map(messageSignature));
    for (const m of optimistic) {
      const sig = messageSignature(m);
      if (!seen.has(sig)) {
        merged.push(m);
        seen.add(sig);
      }
    }
    merged.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    return merged;
  }, [persisted, optimistic]);

  const clearStatus = useCallback(() => setStatus(null), []);
  const clearPendingActions = useCallback(() => setPendingActions([]), []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      if (!uid || !sessionId || !user || !activeChatId) {
        setStatus({ text: "No active session yet.", tone: "error" });
        return;
      }

      const isFirstMessage = messages.length === 0;
      const currentChat = chatsRef.current.find((c) => c.id === activeChatId);

      setSending(true);
      setStatus({ text: "Thinking…", tone: "info" });
      setStreaming("");

      const firebaseUser = user as User;
      const now = Date.now();
      const optimisticMsg: ChatMessage = {
        id: `local-${now}`,
        role: "user",
        content: trimmed,
        createdAt: now,
      };
      setOptimistic((prev) => [...prev, optimisticMsg]);

      void pushUserMessage(uid, sessionId, activeChatId, trimmed).catch((err) => {
        console.warn("Failed to save user message:", err);
      });

      // Auto-rename on first message in a still-default-titled chat
      if (isFirstMessage && currentChat?.title === "New chat") {
        void renameChat(uid, sessionId, activeChatId, trimmed.slice(0, 50)).catch(() => {});
      }

      const recent = [...messages, optimisticMsg]
        .slice(-18)
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      try {
        const token = await firebaseUser.getIdToken();
        const resp = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionId,
            chatId: activeChatId,
            messages: recent,
          }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          const message = await parseError(resp);
          setStatus({ text: message, tone: "error" });
          setStreaming(null);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamed = "";
        setStatus(null);

        function processLine(line: string) {
          const trimmedLine = line.trim();
          if (!trimmedLine) return;
          let signal: StreamSignal | null = null;
          try {
            signal = JSON.parse(trimmedLine) as StreamSignal;
          } catch {
            return;
          }
          if (signal.type === "delta" && signal.text) {
            streamed += signal.text;
            setStreaming(streamed);
          } else if (signal.type === "error") {
            setStatus({
              text: signal.message || "AI unavailable",
              tone: "error",
            });
          } else if (signal.type === "done") {
            const actions = normalizeAiActions(signal.action);
            if (actions.length) {
              setPendingActions(actions);
              setStatus({
                text: "Review suggested workspace changes.",
                tone: "info",
              });
            }
          }
        }

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            processLine(line);
          }
        }

        if (buffer.trim()) {
          processLine(buffer);
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        console.warn("chat request failed", err);
        setStatus({ text: "Network error", tone: "error" });
      } finally {
        setSending(false);
        setStreaming(null);
        abortRef.current = null;
      }
    },
    [messages, sending, uid, sessionId, user, activeChatId],
  );

  const switchChat = useCallback(
    async (chatId: string) => {
      if (!uid || !sessionId || chatId === activeChatId) return;
      clearPendingActions();
      setActiveChatId(chatId);
      setPersisted([]);
      setOptimistic([]);
      setIsReady(false);
      await setActiveChat(uid, sessionId, chatId);
    },
    [uid, sessionId, activeChatId, clearPendingActions],
  );

  const createNewChat = useCallback(
    async (title = "New chat") => {
      if (!uid || !sessionId) return;
      clearPendingActions();
      setPersisted([]);
      setOptimistic([]);
      setIsReady(false);
      await createChat(uid, sessionId, title, true);
    },
    [uid, sessionId, clearPendingActions],
  );

  const renameCurrentChat = useCallback(
    async (title: string) => {
      if (!uid || !sessionId || !activeChatId) return;
      await renameChat(uid, sessionId, activeChatId, title);
    },
    [uid, sessionId, activeChatId],
  );

  const deleteChatById = useCallback(
    async (chatId: string) => {
      if (!uid || !sessionId) return;
      await deleteChat(uid, sessionId, chatId);
      if (chatId === activeChatId) {
        clearPendingActions();
        const remaining = chatsRef.current.filter((c) => c.id !== chatId);
        if (remaining.length > 0) {
          const next = remaining[0];
          setActiveChatId(next.id);
          setPersisted([]);
          setOptimistic([]);
          setIsReady(false);
          await setActiveChat(uid, sessionId, next.id);
        } else {
          setPersisted([]);
          setOptimistic([]);
          setIsReady(false);
          await createChat(uid, sessionId, "New chat", true);
        }
      }
    },
    [uid, sessionId, activeChatId, clearPendingActions],
  );

  return {
    messages,
    streaming,
    status,
    sending,
    send,
    clearStatus,
    pendingActions,
    clearPendingActions,
    isReady,
    chats,
    activeChatId,
    switchChat,
    createNewChat,
    renameCurrentChat,
    deleteChatById,
  };
}
