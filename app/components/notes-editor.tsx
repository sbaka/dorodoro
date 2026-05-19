"use client";

import { useEffect, useRef, useState } from "react";
import type EditorJS from "@editorjs/editorjs";
import type {
  BlockToolData,
  OutputData,
  ToolConstructable,
} from "@editorjs/editorjs";
import {
  CheckSquare,
  Code,
  Heading2,
  List,
  Pilcrow,
  Quote,
} from "lucide-react";

import { useAuth } from "@/app/components/auth-provider";
import { useSessions } from "@/lib/sessions/use-sessions";
import {
  loadNotesOnce,
  saveNotes,
  subscribeToNotes,
} from "@/lib/workspace/notes";

const SAVE_DELAY_MS = 800;

type Status = "idle" | "loading" | "saving" | "saved" | "error";

export function NotesEditor({ columnId }: { columnId?: string } = {}) {
  const { user } = useAuth();
  const { activeId } = useSessions();
  const uid = user?.uid ?? "";
  const sessionId = activeId;

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const holderRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorJS | null>(null);
  const pendingDataRef = useRef<OutputData | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteEchoRef = useRef<string | null>(null);
  const isEditorReadyRef = useRef(false);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    const holderElement = holderRef.current;
    if (!holderElement) return;
    const editorHolder: HTMLDivElement = holderElement;

    if (!uid || !sessionId) {
      isEditorReadyRef.current = false;
      setEditorReady(false);
      editorRef.current?.destroy();
      editorRef.current = null;
      editorHolder.innerHTML = "";
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let activeEditor: EditorJS | null = null;

    function destroyActiveEditor() {
      if (!activeEditor) return;
      try {
        activeEditor.destroy();
      } catch {
        // Editor.js can throw if cleanup races its async initialization.
      }
      if (editorRef.current === activeEditor) {
        editorRef.current = null;
      }
      activeEditor = null;
    }

    function clearSaveTimer() {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    }

    function scheduleSave(data: OutputData) {
      clearSaveTimer();
      setStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        const serialized = serializeEditorData(data);
        try {
          remoteEchoRef.current = serialized;
          await saveNotes(uid, sessionId, data, columnId);
          if (pendingDataRef.current) {
            const stillPending = serializeEditorData(pendingDataRef.current);
            if (stillPending === serialized) {
              pendingDataRef.current = null;
              setStatus("saved");
            }
          }
        } catch (err) {
          console.error("Failed to save notes:", err);
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }, SAVE_DELAY_MS);
    }

    async function setupEditor() {
      setStatus("loading");
      setError(null);
      isEditorReadyRef.current = false;
      setEditorReady(false);
      pendingDataRef.current = null;
      remoteEchoRef.current = null;
      editorHolder.innerHTML = "";

      try {
        const [
          { default: Editor },
          { default: Header },
          { default: List },
          { default: Quote },
          { default: Checklist },
          { default: CodeTool },
          { default: Marker },
          { default: InlineCode },
          { default: Embed },
          doc,
        ] = await Promise.all([
          import("@editorjs/editorjs"),
          import("@editorjs/header"),
          import("@editorjs/list"),
          import("@editorjs/quote"),
          import("@editorjs/checklist"),
          import("@editorjs/code"),
          import("@editorjs/marker"),
          import("@editorjs/inline-code"),
          import("@editorjs/embed"),
          loadNotesOnce(uid, sessionId, columnId),
        ]);

        if (cancelled) return;

        const editor = new Editor({
          holder: editorHolder,
          data: doc.editorData,
          minHeight: 180,
          placeholder: "Write session notes...",
          inlineToolbar: ["marker", "inlineCode"],
          tools: {
            header: {
              class: asTool(Header),
              inlineToolbar: true,
              config: {
                levels: [1, 2, 3],
                defaultLevel: 2,
              },
            },
            list: {
              class: asTool(List),
              inlineToolbar: true,
            },
            quote: {
              class: asTool(Quote),
              inlineToolbar: true,
            },
            checklist: {
              class: asTool(Checklist),
              inlineToolbar: true,
            },
            code: asTool(CodeTool),
            marker: asTool(Marker),
            inlineCode: asTool(InlineCode),
            embed: {
              class: asTool(Embed),
              config: {
                services: {
                  youtube: true,
                  vimeo: true,
                  codepen: true,
                  twitter: true,
                  instagram: true,
                },
              },
            },
          },
          onChange: async () => {
            const instance = editorRef.current;
            if (
              !instance ||
              !isEditorReadyRef.current ||
              applyingRemoteRef.current
            ) {
              return;
            }

            try {
              const data = await instance.save();
              pendingDataRef.current = data;
              scheduleSave(data);
            } catch (err) {
              console.error("Failed to serialize notes:", err);
              setError(err instanceof Error ? err.message : String(err));
              setStatus("error");
            }
          },
        });

        activeEditor = editor;
        editorRef.current = editor;
        await editor.isReady;

        if (cancelled) {
          destroyActiveEditor();
          return;
        }

        remoteEchoRef.current = serializeEditorData(doc.editorData);
        isEditorReadyRef.current = true;
        setEditorReady(true);
        setStatus("idle");

        unsubscribe = subscribeToNotes(
          uid,
          sessionId,
          (nextDoc) => {
            const instance = editorRef.current;
            if (!instance || !isEditorReadyRef.current) return;

            const serialized = serializeEditorData(nextDoc.editorData);
            if (serialized === remoteEchoRef.current) return;
            if (pendingDataRef.current !== null) return;

            applyingRemoteRef.current = true;
            void instance
              .render(nextDoc.editorData)
              .then(() => {
                remoteEchoRef.current = serialized;
              })
              .catch((err) => {
                console.error("Failed to render remote notes:", err);
                setError(err instanceof Error ? err.message : String(err));
                setStatus("error");
              })
              .finally(() => {
                applyingRemoteRef.current = false;
              });
          },
          (err) => {
            setError(err.message);
            setStatus("error");
          },
          columnId,
        );
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to initialize Editor.js:", err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }

    void setupEditor();

    return () => {
      cancelled = true;
      unsubscribe?.();
      clearSaveTimer();

      const data = pendingDataRef.current;
      if (data) {
        void saveNotes(uid, sessionId, data, columnId).catch(() => { });
      }

      pendingDataRef.current = null;
      isEditorReadyRef.current = false;
      setEditorReady(false);
      applyingRemoteRef.current = false;
      destroyActiveEditor();
    };
  }, [uid, sessionId, columnId]);

  async function insertBlock(type: string, data?: Partial<BlockToolData>) {
    const editor = editorRef.current;
    if (!editor || !isEditorReadyRef.current) return;

    const currentIndex = editor.blocks.getCurrentBlockIndex();
    const blockCount = editor.blocks.getBlocksCount();
    const insertAt = currentIndex >= 0 ? currentIndex + 1 : blockCount;
    const baseData = await editor.blocks.composeBlockData(type);

    editor.blocks.insert(
      type,
      { ...baseData, ...data },
      undefined,
      insertAt,
      true,
    );
  }

  const statusLabel =
    status === "saving"
      ? "Saving..."
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Couldn't save"
          : status === "loading"
            ? "Loading..."
            : "";

  return (
    <div className="notes-editor">
      <header className="notes-editor-header">
        <h3>Notes</h3>
        <span
          className={`notes-editor-status notes-editor-status--${status}`}
          aria-live="polite"
        >
          {statusLabel}
        </span>
      </header>
      {error && status === "error" ? (
        <p className="settings-notice settings-notice--error">{error}</p>
      ) : null}
      <NotesToolbar
        disabled={!editorReady || !uid || !sessionId}
        onInsert={(type, data) => {
          void insertBlock(type, data);
        }}
      />
      <div className="notes-editor-wrap">
        <div
          ref={holderRef}
          className="notes-editor-surface z-50"
          aria-label="Session notes editor"
        />
      </div>
    </div>
  );
}

type NotesToolbarProps = {
  disabled: boolean;
  onInsert: (type: string, data?: Partial<BlockToolData>) => void;
};

function NotesToolbar({ disabled, onInsert }: NotesToolbarProps) {
  return (
    <div className="notes-editor-toolbar" role="toolbar" aria-label="Note blocks">
      <button
        type="button"
        onClick={() => onInsert("paragraph")}
        disabled={disabled}
        aria-label="Add text"
        title="Text"
      >
        <Pilcrow className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("header", { level: 2 })}
        disabled={disabled}
        aria-label="Add heading"
        title="Heading"
      >
        <Heading2 className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("list")}
        disabled={disabled}
        aria-label="Add list"
        title="List"
      >
        <List className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("checklist")}
        disabled={disabled}
        aria-label="Add checklist"
        title="Checklist"
      >
        <CheckSquare className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("quote")}
        disabled={disabled}
        aria-label="Add quote"
        title="Quote"
      >
        <Quote className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("code")}
        disabled={disabled}
        aria-label="Add code block"
        title="Code"
      >
        <Code className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function asTool(tool: unknown): ToolConstructable {
  return tool as ToolConstructable;
}

function serializeEditorData(data: OutputData): string {
  return JSON.stringify(data);
}
