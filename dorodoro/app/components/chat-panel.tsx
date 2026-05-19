"use client";

import {
  Check,
  ChevronDown,
  FileText,
  ListTodo,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { useAuth } from "@/app/components/auth-provider";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { usePreferences } from "@/lib/preferences/use-preferences";
import { useSessions } from "@/lib/sessions/use-sessions";
import {
  useSessionChat,
  type AiAction,
} from "@/lib/chat/use-session-chat";
import { renameChat, type ChatThread } from "@/lib/chat/chats";
import { createColumn, loadColumnsOnce } from "@/lib/workspace/board";
import { saveNotes, textToEditorData } from "@/lib/workspace/notes";
import { createTodo } from "@/lib/workspace/todos";

const STARTERS = [
  "Help me plan what to tackle in this session.",
  "Summarize my notes so I know where I left off.",
  "Break my current task into a short todo list.",
];

function stripActionBlocks(text: string): string {
  return text.replace(/<doro-action>[\s\S]*?<\/doro-action>/gi, "").trim();
}

function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="assistant-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

type ChatSwitcherProps = {
  chats: ChatThread[];
  activeChatId: string | null;
  onSwitch: (chatId: string) => Promise<void>;
  onNew: () => void;
  onRenameRequest: (chatId: string, currentTitle: string) => void;
  onDeleteRequest: (chatId: string) => void;
};

function ChatSwitcher({
  chats,
  activeChatId,
  onSwitch,
  onNew,
  onRenameRequest,
  onDeleteRequest,
}: ChatSwitcherProps) {
  const activeChat = chats.find((c) => c.id === activeChatId);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 border-b px-4 py-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        {/* base-ui Trigger renders a <button> — content goes directly inside */}
        <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-1 truncate rounded text-left text-sm font-medium text-muted-foreground hover:text-foreground">
          <span className="truncate">{activeChat?.title ?? "New chat"}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {/* Custom div rows avoid Menu.Item auto-close so rename/delete work */}
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                onClick={() => {
                  setOpen(false);
                  if (chat.id !== activeChatId) void onSwitch(chat.id);
                }}
              >
                {chat.id === activeChatId ? (
                  <Check className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <span className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{chat.title}</span>
              </button>
              <div className="ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Rename chat"
                  onClick={() => { setOpen(false); onRenameRequest(chat.id, chat.title); }}
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  aria-label="Delete chat"
                  onClick={() => { setOpen(false); onDeleteRequest(chat.id); }}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
          {chats.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={onNew} className="gap-2">
            <Plus className="size-3.5" />
            New chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label="New chat"
        onClick={onNew}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

type ChatPanelProps = {
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  variant?: "sheet" | "inline";
};

export function ChatPanel({
  open,
  onOpen,
  onClose,
  variant = "sheet",
}: ChatPanelProps = {}) {
  const isControlled = typeof open === "boolean";
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = isControlled ? open! : localOpen;
  const { preferences } = usePreferences();
  const { user } = useAuth();
  const { activeId } = useSessions();
  const uid = user?.uid ?? "";
  const sessionId = activeId;

  function setOpen(next: boolean) {
    if (isControlled) {
      if (next) onOpen?.();
      else onClose?.();
    } else {
      setLocalOpen(next);
    }
  }

  const [draft, setDraft] = useState("");
  const {
    messages,
    streaming,
    status,
    sending,
    send,
    pendingActions,
    clearPendingActions,
    isReady,
    chats,
    activeChatId,
    switchChat,
    createNewChat,
    renameCurrentChat,
    deleteChatById,
  } = useSessionChat();
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [applyingActions, setApplyingActions] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Rename state
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Delete state
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const deleteChatTitle = chats.find((c) => c.id === deleteChatId)?.title ?? "this chat";

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, isOpen]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [draft]);

  useEffect(() => {
    if (pendingActions.length) {
      setActionDialogOpen(true);
      setActionStatus(null);
    }
  }, [pendingActions]);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await send(text);
  }

  function applyStarter(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  async function applyPendingActions() {
    if (!uid || !sessionId || !pendingActions.length || applyingActions) return;

    setApplyingActions(true);
    setActionStatus(null);
    try {
      const columns = await loadColumnsOnce(uid, sessionId);
      let nextColumnOrder = columns.length;

      for (const action of pendingActions) {
        if (action.type === "create_note") {
          const column = await createColumn(uid, sessionId, {
            title: action.title,
            type: "notes",
            order: nextColumnOrder,
          });
          nextColumnOrder += 1;
          await saveNotes(uid, sessionId, textToEditorData(action.content), column.id);
        } else {
          const column = await createColumn(uid, sessionId, {
            title: action.title,
            type: "todos",
            order: nextColumnOrder,
          });
          nextColumnOrder += 1;
          for (const [index, item] of action.items.entries()) {
            await createTodo(
              uid,
              sessionId,
              item.text,
              index,
              column.id,
              item.priority,
            );
          }
        }
      }

      clearPendingActions();
      setActionDialogOpen(false);
      setActionStatus("Workspace changes added.");
    } catch (err) {
      console.error("Failed to apply AI workspace actions:", err);
      setActionStatus("Could not add those workspace changes.");
    } finally {
      setApplyingActions(false);
    }
  }

  function dismissPendingActions() {
    clearPendingActions();
    setActionDialogOpen(false);
    setActionStatus(null);
  }

  function handleRenameRequest(chatId: string, currentTitle: string) {
    setRenameChatId(chatId);
    setRenameDraft(currentTitle);
  }

  async function submitRename() {
    const title = renameDraft.trim();
    if (!title || !renameChatId || !uid || !sessionId) return;
    if (renameChatId === activeChatId) {
      await renameCurrentChat(title);
    } else {
      await renameChat(uid, sessionId, renameChatId, title);
    }
    setRenameChatId(null);
    setRenameDraft("");
  }

  async function confirmDelete() {
    if (!deleteChatId) return;
    await deleteChatById(deleteChatId);
    setDeleteChatId(null);
  }

  const visibleMessages = messages;
  const showEmpty = !visibleMessages.length && !streaming && isReady;
  const actionSummary = summarizeActions(pendingActions);
  const panelContent = (
    <>
      <div className="border-b p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="size-4" aria-hidden="true" />
          AI assistant
        </h2>
        <p className="sr-only">
          Ask the AI assistant about your current focus session.
        </p>
      </div>

      {chats.length > 0 ? (
        <ChatSwitcher
          chats={chats}
          activeChatId={activeChatId}
          onSwitch={switchChat}
          onNew={() => void createNewChat()}
          onRenameRequest={handleRenameRequest}
          onDeleteRequest={(id) => setDeleteChatId(id)}
        />
      ) : null}

      <div
        className="flex-1 overflow-y-auto p-4"
        ref={listRef}
        aria-live="polite"
      >
        {showEmpty ? (
          <div className="m-auto grid gap-3 text-center">
            <h3 className="text-base font-semibold text-foreground">
              What can I help with?
            </h3>
            <p className="text-sm text-muted-foreground">
              Ask about this session or pick a starter.
            </p>
            {preferences.assistantStarterPrompts ? (
              <div className="mt-2 grid gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-xl border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-ring hover:bg-muted"
                    onClick={() => applyStarter(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Starter prompts are hidden in your settings. Type any question to begin.
              </p>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {visibleMessages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.role === "user"
                  ? "ml-auto max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-auto max-w-[85%] wrap-break-word rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
              }
            >
              {msg.role === "assistant" ? (
                <AssistantMarkdown
                  text={stripActionBlocks(msg.content)}
                />
              ) : (
                msg.content
              )}
            </div>
          ))}

          {streaming !== null ? (
            <div className="ai-chat-streaming mr-auto max-w-[85%] wrap-break-word rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              <AssistantMarkdown
                text={stripActionBlocks(streaming) || "…"}
              />
            </div>
          ) : null}
        </div>
      </div>

      {status ? (
        <div
          className={
            status.tone === "error"
              ? "border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive"
              : "border-t px-4 py-2 text-sm text-muted-foreground"
          }
          role="status"
        >
          {status.text}
        </div>
      ) : null}

      {pendingActions.length ? (
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-sm">
          <span className="text-muted-foreground">{actionSummary}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActionDialogOpen(true)}
          >
            Review
          </Button>
        </div>
      ) : actionStatus ? (
        <div className="border-t px-4 py-2 text-sm text-muted-foreground">
          {actionStatus}
        </div>
      ) : null}

      <form
        className="grid gap-2 border-t p-3"
        onSubmit={submit}
      >
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Textarea
            ref={textareaRef}
            placeholder="Ask about this session…"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            disabled={sending}
            className="max-h-35 min-h-10 resize-none"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={!draft.trim() || sending}
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          AI can make mistakes. Check important info.
        </p>
      </form>
    </>
  );

  return (
    <>
      {variant === "inline" ? (
        <section
          className="assistant-inline-panel"
          style={{
            display: "flex",
            minHeight: 0,
            height: "100%",
            flexDirection: "column",
            overflow: "hidden",
            background: "#fff",
            border: "var(--nb-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow)",
          }}
        >
          {panelContent}
        </section>
      ) : (
        <>
          <Button
            type="button"
            size="icon-lg"
            className="ai-fab fixed right-5 bottom-5 z-40 size-14 rounded-full border-2 border-white shadow-xl"
            aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
            aria-expanded={isOpen}
            onClick={() => setOpen(!isOpen)}
          >
            <Sparkles className="size-5" />
          </Button>

          <Sheet open={isOpen} onOpenChange={setOpen}>
            <SheetContent
              side="right"
              className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
            >
              {panelContent}
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* Pending workspace actions dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add AI workspace changes?</DialogTitle>
            <DialogDescription>
              Review the notes and todo lists before they are saved to this session.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-80 gap-3 overflow-y-auto py-1">
            {pendingActions.map((action, index) => (
              <ActionPreview key={`${action.type}-${index}`} action={action} />
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={dismissPendingActions}
              disabled={applyingActions}
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={() => void applyPendingActions()}
              disabled={applyingActions || !uid || !sessionId}
            >
              {applyingActions ? "Adding..." : "Add to workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename chat dialog */}
      <Dialog
        open={renameChatId !== null}
        onOpenChange={(o) => { if (!o) { setRenameChatId(null); setRenameDraft(""); } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription className="sr-only">
              Enter a new name for this chat.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitRename();
              }
            }}
            maxLength={80}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setRenameChatId(null); setRenameDraft(""); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!renameDraft.trim()}
              onClick={() => void submitRename()}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete chat confirmation */}
      <AlertDialog
        open={deleteChatId !== null}
        onOpenChange={(o) => { if (!o) setDeleteChatId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteChatTitle}&rdquo; and its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function summarizeActions(actions: AiAction[]): string {
  const notes = actions.filter((action) => action.type === "create_note").length;
  const todoLists = actions.filter((action) => action.type === "create_todo_list").length;
  const parts = [
    notes ? `${notes} note${notes === 1 ? "" : "s"}` : "",
    todoLists ? `${todoLists} todo list${todoLists === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return `AI drafted ${parts.join(" and ")}.`;
}

function ActionPreview({ action }: { action: AiAction }) {
  if (action.type === "create_note") {
    return (
      <section className="rounded-lg border p-3">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4" />
          {action.title}
        </h4>
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {action.content}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-3">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        <ListTodo className="size-4" />
        {action.title}
      </h4>
      <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
        {action.items.slice(0, 5).map((item, index) => (
          <li key={`${item.text}-${index}`} className="flex justify-between gap-3">
            <span className="truncate">{item.text}</span>
            <span className="shrink-0 capitalize">{item.priority}</span>
          </li>
        ))}
      </ul>
      {action.items.length > 5 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          +{action.items.length - 5} more
        </p>
      ) : null}
    </section>
  );
}

// Keep a named export for callers that want the floating "new chat" style.
export { Plus as NewChatIcon };
