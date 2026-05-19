import { NextResponse } from "next/server";

export const DEFAULT_WORKER_URL = "https://dorodoro-ai.dorodoro.workers.dev";

const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const CHAT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const MAX_NOTES_CHARS = 40000;
const MAX_TODOS = 20;
const MAX_TODO_ITEMS = 20;

type ChatRole = "user" | "assistant";

type NormalizedMessage = {
  role: ChatRole;
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeMessages(value: unknown): NormalizedMessage[] | null {
  if (!Array.isArray(value) || !value.length) return null;

  const messages = value
    .slice(-MAX_MESSAGES)
    .map((item) => {
      if (!isRecord(item)) return null;
      const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
      const content = cleanText(item.content, MAX_MESSAGE_CHARS);
      if (!role || !content) return null;
      return { role, content };
    })
    .filter((item): item is NormalizedMessage => item !== null);

  return messages.length ? messages : null;
}

function normalizeTodos(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_TODOS).map((column) => {
    const source = isRecord(column) ? column : {};
    const items = Array.isArray(source.items)
      ? source.items.slice(0, MAX_TODO_ITEMS).map((item) => {
          const base = isRecord(item) ? item : {};
          return {
            text: cleanText(base.text, 160),
            done: base.done === true,
            priority: base.priority === "low" || base.priority === "high" ? base.priority : "medium",
          };
        }).filter((item) => item.text)
      : [];

    return {
      title: cleanText(source.title, 80),
      items,
    };
  });
}

function normalizeContext(value: unknown) {
  if (!isRecord(value)) return undefined;

  return {
    sessionTitle: cleanText(value.sessionTitle, 80),
    notes: cleanText(value.notes, MAX_NOTES_CHARS),
    todos: normalizeTodos(value.todos),
  };
}

export function getWorkerUrl(path: "/chat" | "/quota"): string {
  const base = (process.env.WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, "");
  return `${base}${path}`;
}

export function getWorkerSecret(): string | null {
  const secret = process.env.WORKER_SHARED_SECRET?.trim();
  return secret || null;
}

export function normalizeChatBody(body: unknown) {
  if (!isRecord(body)) {
    return { error: "Invalid JSON body." };
  }

  const sessionId = cleanText(body.sessionId, 128);
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return { error: "Invalid session id." };
  }

  const chatId = cleanText(body.chatId, 128);
  if (!chatId || !CHAT_ID_RE.test(chatId)) {
    return { error: "Invalid chat id." };
  }

  const messages = normalizeMessages(body.messages);
  if (!messages) {
    return { error: "At least one chat message is required." };
  }

  return {
    payload: {
      sessionId,
      chatId,
      messages,
      context: normalizeContext(body.context),
    },
  };
}

export async function parseJsonBody(request: Request): Promise<{ body?: unknown; response?: Response }> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 256 * 1024) {
    return {
      response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }),
    };
  }

  try {
    return { body: await request.json() };
  } catch {
    return {
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }
}
