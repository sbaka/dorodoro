"use client";

import { MoreHorizontal, Plus, Archive, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { useSessions } from "@/lib/sessions/use-sessions";
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
import { Button } from "@/components/ui/button";

export function SessionSwitcher() {
  const { sessions, active, status, create, rename, archive, setActive, error } =
    useSessions();

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    setRenameDraft(active?.title ?? "");
  }, [active?.id, active?.title]);

  async function handleNew() {
    await create("New session");
  }

  async function handleRenameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !renameDraft.trim()) return;
    await rename(active.id, renameDraft.trim());
    setRenameOpen(false);
  }

  async function handleArchive() {
    if (!active || sessions.length <= 1) return;
    await archive(active.id);
  }

  if (status === "error") {
    return (
      <div className="sessions-strip-inner">
        <p className="text-sm" style={{ color: "var(--red)" }}>
          {error ?? "Could not load sessions."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="sessions-strip-inner" role="navigation" aria-label="Sessions">
        <span className="sessions-strip-label">Session</span>

        <div className="sessions-pills-row">
          {status === "loading" ? (
            <span className="session-pill session-pill--skeleton">Loading…</span>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === active?.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  className={`session-pill${isActive ? " session-pill--active" : ""}`}
                  onClick={() => !isActive && void setActive(session.id)}
                  aria-current={isActive ? "true" : undefined}
                >
                  {session.title}
                </button>
              );
            })
          )}
        </div>

        <div className="sessions-strip-actions">
          {/* Active session: rename / archive */}
          {active && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="session-action-btn"
                aria-label="Session options"
                title="Session options"
              >
                <MoreHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6}>
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void handleArchive()}
                  disabled={sessions.length <= 1}
                  variant="destructive"
                >
                  <Archive className="size-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* New session */}
          <button
            type="button"
            className="session-new-btn"
            onClick={() => void handleNew()}
            aria-label="New session"
            title="New session"
          >
            <Plus size={16} />
            New
          </button>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={(v) => !v && setRenameOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename session</DialogTitle>
          </DialogHeader>
          <form id="session-rename-form" onSubmit={handleRenameSubmit} className="grid gap-2">
            <Label htmlFor="session-rename-input">Session title</Label>
            <Input
              id="session-rename-input"
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              maxLength={60}
            />
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="session-rename-form" disabled={!renameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
