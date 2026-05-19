"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import { NotesEditor } from "@/app/components/notes-editor";
import { TodosList } from "@/app/components/todos-list";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessions } from "@/lib/sessions/use-sessions";
import {
  createColumn,
  deleteColumn,
  renameColumn,
  subscribeToColumns,
  type BoardColumn,
  type BoardColumnType,
} from "@/lib/workspace/board";

type DialogMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "rename"; column: BoardColumn };

export function WorkspaceTabs() {
  const { user } = useAuth();
  const { activeId } = useSessions();
  const uid = user?.uid ?? "";
  const sessionId = activeId;

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string>("");
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });
  const [titleDraft, setTitleDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState<BoardColumnType>("notes");
  const [confirmDelete, setConfirmDelete] = useState<BoardColumn | null>(null);

  useEffect(() => {
    if (!uid || !sessionId) {
      setColumns([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    setError(null);
    const unsub = subscribeToColumns(
      uid,
      sessionId,
      (cols) => {
        setColumns(cols);
        setStatus("ready");
      },
      (err) => {
        setError(err.message);
        setStatus("error");
      },
    );
    return unsub;
  }, [uid, sessionId]);

  useEffect(() => {
    if (!columns.length) {
      setActiveColumnId("");
      return;
    }
    if (!columns.find((c) => c.id === activeColumnId)) {
      setActiveColumnId(columns[0].id);
    }
  }, [columns, activeColumnId]);

  const active = columns.find((c) => c.id === activeColumnId);

  function openCreate() {
    setTitleDraft("");
    setTypeDraft("notes");
    setDialog({ kind: "create" });
  }

  function openRename(column: BoardColumn) {
    setTitleDraft(column.title);
    setTypeDraft(column.type);
    setDialog({ kind: "rename", column });
  }

  function closeDialog() {
    setDialog({ kind: "closed" });
  }

  async function handleDialogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uid || !sessionId) return;
    const title = titleDraft.trim();
    try {
      if (dialog.kind === "create") {
        const col = await createColumn(uid, sessionId, {
          title,
          type: typeDraft,
          order: columns.length,
        });
        setActiveColumnId(col.id);
      } else if (dialog.kind === "rename") {
        await renameColumn(uid, sessionId, dialog.column.id, title, dialog.column.type);
      }
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(column: BoardColumn) {
    if (!uid || !sessionId) return;
    try {
      await deleteColumn(uid, sessionId, column.id, column.type);
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const empty = status === "ready" && columns.length === 0;

  return (
    <div className="workspace-tabs">

      {/* ── Tab bar ── */}
      <div className="workspace-tab-bar" role="tablist" aria-label="Workspace columns">
        <div className="workspace-tab-list">
          {columns.map((col) => {
            const isActive = col.id === activeColumnId;
            return (
              <button
                key={col.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`workspace-tab${isActive ? " workspace-tab--active" : ""}`}
                onClick={() => setActiveColumnId(col.id)}
              >
                <span className="workspace-tab-icon">
                  {col.type === "todos" ? "✅" : "📝"}
                </span>
                <span className="workspace-tab-label">{col.title}</span>
              </button>
            );
          })}
        </div>

        <div className="workspace-tab-actions">
          {/* Active tab options: rename / delete */}
          {active && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="workspace-tab-menu-btn"
                aria-label="Column options"
                title="Column options"
              >
                <MoreHorizontal size={15} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6}>
                <DropdownMenuItem onClick={() => openRename(active)}>
                  <Pencil className="size-4" />
                  Rename tab
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(active)}
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete tab
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Add tab */}
          <button
            type="button"
            className="workspace-tab-add-btn"
            onClick={openCreate}
            disabled={!uid || !sessionId}
            aria-label="Add tab"
            title="Add tab"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {error && (
        <p className="settings-notice settings-notice--error m-2 mt-0">{error}</p>
      )}

      {/* ── Tab content ── */}
      {status === "loading" ? (
        <div className="workspace-empty">
          <span className="workspace-empty-icon">⏳</span>
          <p>Loading…</p>
        </div>
      ) : empty ? (
        <div className="workspace-empty">
          <span className="workspace-empty-icon">📂</span>
          <strong>No tabs yet</strong>
          <p>Add a notes or todos tab to get started.</p>
          <button
            type="button"
            className="primary-pill"
            style={{ fontSize: "0.92rem", padding: "0.55rem 1.2rem" }}
            onClick={openCreate}
          >
            <Plus size={14} style={{ display: "inline" }} /> Add first tab
          </button>
        </div>
      ) : active ? (
        <div className="workspace-tab-panel" role="tabpanel">
          {active.type === "notes" ? (
            <NotesEditor key={active.id} columnId={active.id} />
          ) : (
            <TodosList key={active.id} columnId={active.id} />
          )}
        </div>
      ) : null}

      {/* Rename / Add dialog */}
      <Dialog open={dialog.kind !== "closed"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog.kind === "rename" ? "Rename tab" : "Add tab"}</DialogTitle>
          </DialogHeader>
          <form id="board-column-form" onSubmit={handleDialogSubmit} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="board-column-title">Title</Label>
              <Input
                id="board-column-title"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={40}
                placeholder={typeDraft === "todos" ? "Todo list" : "My notes"}
              />
            </div>
            {dialog.kind === "create" && (
              <div className="grid gap-2">
                <Label>Type</Label>
                <div className="workspace-type-toggle">
                  {(["notes", "todos"] as BoardColumnType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`workspace-type-btn${typeDraft === t ? " workspace-type-btn--active" : ""}`}
                      onClick={() => setTypeDraft(t)}
                    >
                      {t === "notes" ? "📝 Notes" : "✅ Todos"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" form="board-column-form" disabled={!titleDraft.trim()}>
              {dialog.kind === "rename" ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tab?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirmDelete?.title}&rdquo; and all its content will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && void handleDelete(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
