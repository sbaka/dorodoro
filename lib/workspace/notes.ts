import { get, off, onValue, ref, update } from "firebase/database";
import type { OutputData } from "@editorjs/editorjs";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type NotesDoc = {
  editorData: OutputData;
  updatedAt: number;
};

function emptyEditorData(): OutputData {
  return { blocks: [] };
}

const EMPTY_NOTES: NotesDoc = { editorData: emptyEditorData(), updatedAt: 0 };

function notesPath(uid: string, sessionId: string, columnId?: string): string {
  if (columnId) {
    return `users/${uid}/sessions/${sessionId}/board/notes/${columnId}`;
  }
  return `users/${uid}/sessions/${sessionId}/notes`;
}

export function subscribeToNotes(
  uid: string,
  sessionId: string,
  onData: (notes: NotesDoc) => void,
  onError: (error: Error) => void,
  columnId?: string,
): () => void {
  const db = getFirebaseDatabase();
  const notesRef = ref(db, notesPath(uid, sessionId, columnId));
  const unsubscribe = onValue(
    notesRef,
    (snap) => {
      const raw = snap.val();
      if (!raw || typeof raw !== "object") {
        onData(EMPTY_NOTES);
        return;
      }
      onData({
        editorData: normalizeEditorData((raw as Partial<NotesDoc>).editorData),
        updatedAt: Number(raw.updatedAt) || 0,
      });
    },
    (err) => onError(err instanceof Error ? err : new Error(String(err))),
  );
  return () => {
    off(notesRef);
    unsubscribe();
  };
}

export async function saveNotes(
  uid: string,
  sessionId: string,
  editorData: OutputData,
  columnId?: string,
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, notesPath(uid, sessionId, columnId)), {
    editorData: normalizeEditorData(editorData),
    updatedAt: Date.now(),
  });
}

export async function loadNotesOnce(
  uid: string,
  sessionId: string,
  columnId?: string,
): Promise<NotesDoc> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, notesPath(uid, sessionId, columnId)));
  const raw = snap.val();
  if (!raw || typeof raw !== "object") return EMPTY_NOTES;
  return {
    editorData: normalizeEditorData((raw as Partial<NotesDoc>).editorData),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

export function textToEditorData(text: string): OutputData {
  return {
    time: Date.now(),
    blocks: markdownToEditorBlocks(text),
  };
}

function markdownToEditorBlocks(text: string): OutputData["blocks"] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: OutputData["blocks"] = [];
  let paragraph: string[] = [];
  let index = 0;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({
      type: "paragraph",
      data: {
        text: formatInlineMarkdown(paragraph.join(" ")),
      },
    });
    paragraph = [];
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```(?:\w+)?\s*$/);
    if (fence) {
      flushParagraph();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        type: "code",
        data: { code: codeLines.join("\n") },
      });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "header",
        data: {
          text: formatInlineMarkdown(heading[2]),
          level: Math.min(3, Math.max(1, heading[1].length)),
        },
      });
      index += 1;
      continue;
    }

    const checklist = collectChecklist(lines, index);
    if (checklist) {
      flushParagraph();
      blocks.push(checklist.block);
      index = checklist.nextIndex;
      continue;
    }

    const list = collectList(lines, index);
    if (list) {
      flushParagraph();
      blocks.push(list.block);
      index = list.nextIndex;
      continue;
    }

    const quote = collectQuote(lines, index);
    if (quote) {
      flushParagraph();
      blocks.push(quote.block);
      index = quote.nextIndex;
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function collectChecklist(
  lines: string[],
  startIndex: number,
): { block: OutputData["blocks"][number]; nextIndex: number } | null {
  const items: Array<{ text: string; checked: boolean }> = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].trim().match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (!match) break;
    items.push({
      checked: match[1].toLowerCase() === "x",
      text: formatInlineMarkdown(match[2]),
    });
    index += 1;
  }

  if (!items.length) return null;
  return {
    block: {
      type: "checklist",
      data: { items },
    },
    nextIndex: index,
  };
}

function collectList(
  lines: string[],
  startIndex: number,
): { block: OutputData["blocks"][number]; nextIndex: number } | null {
  const first = parseListItem(lines[startIndex]);
  if (!first) return null;

  const items = [];
  let index = startIndex;
  let style = first.ordered ? "ordered" : "unordered";

  while (index < lines.length) {
    const parsed = parseListItem(lines[index]);
    if (!parsed || parsed.ordered !== first.ordered) break;
    style = parsed.ordered ? "ordered" : "unordered";
    items.push({
      content: formatInlineMarkdown(parsed.text),
      meta: {},
      items: [],
    });
    index += 1;
  }

  return {
    block: {
      type: "list",
      data: { style, items },
    },
    nextIndex: index,
  };
}

function collectQuote(
  lines: string[],
  startIndex: number,
): { block: OutputData["blocks"][number]; nextIndex: number } | null {
  const quoteLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].trim().match(/^>\s?(.*)$/);
    if (!match) break;
    quoteLines.push(match[1].trim());
    index += 1;
  }

  if (!quoteLines.length) return null;
  return {
    block: {
      type: "quote",
      data: {
        text: formatInlineMarkdown(quoteLines.join(" ")),
        caption: "",
        alignment: "left",
      },
    },
    nextIndex: index,
  };
}

function parseListItem(line: string): { ordered: boolean; text: string } | null {
  const trimmed = line.trim();
  const unordered = trimmed.match(/^[-*]\s+(?!\[[ xX]\]\s)(.+)$/);
  if (unordered) return { ordered: false, text: unordered[1] };

  const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
  if (ordered) return { ordered: true, text: ordered[1] };

  return null;
}

function formatInlineMarkdown(text: string): string {
  const escaped = escapeEditorText(text.trim());

  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/__([^_]+)__/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/_([^_]+)_/g, "<i>$1</i>");
}

function normalizeEditorData(value: unknown): OutputData {
  if (!value || typeof value !== "object") return emptyEditorData();
  const raw = value as Partial<OutputData>;
  if (!Array.isArray(raw.blocks)) return emptyEditorData();

  const normalized: OutputData = {
    blocks: raw.blocks.filter((block) => {
      return (
        block &&
        typeof block === "object" &&
        typeof block.type === "string" &&
        block.data &&
        typeof block.data === "object"
      );
    }),
  };

  if (typeof raw.time === "number") {
    normalized.time = raw.time;
  }

  if (typeof raw.version === "string") {
    normalized.version = raw.version;
  }

  return normalized;
}

function escapeEditorText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
