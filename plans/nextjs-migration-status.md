# Next.js Migration Status

Updated: 2026-04-23

## How to read this plan

Each slice below lists a scoped, independently shippable unit of work. After
finishing a slice we:

1. Flip its `Status` marker to `Done`.
2. Add a `Landed` bullet list under the slice describing what shipped.
3. Note any follow-ups under `Deferred` for later slices.

Global rule for this migration: RTDB reads/writes stay on the client SDK for
now. The session cookie + `proxy.ts` handle route protection, but data access
still runs in React components through `firebase/database`. Server-side
Admin SDK work is tracked as a later slice.

UI rule: prefer shadcn/ui primitives (Dialog, Sheet, AlertDialog,
DropdownMenu, Tabs, Tooltip, Toast, form primitives, etc.) installed
via the shadcn CLI over hand-rolled markup. Only fall back to custom
markup when no shadcn primitive fits. This applies to new work and to
any retrofits called out in future slices.

## Foundation (shipped before slices started)

- Next app at `next-js/dorodoro` with App Router routes for `/`, `/about`,
  `/home`, `/login`, `/settings`, `/sign-up`, `/start`.
- Shared layout, metadata, global styles, reusable header, and public assets
  copied into the Next app.
- `turbopack.root` pinned in `next.config.ts` so builds ignore the parent
  lockfile.
- Firebase client auth, auth provider, and access rules (verified email or
  Google) in the Next app.
- `/login` covers email/password, Google, password reset, magic-link send +
  completion. `/sign-up` sends verification then routes to `/login`.
- Client `<RequireAuth>` / `<GuestOnly>` guards protect `/home`, `/start`,
  `/settings` and bounce signed-in users away from `/login`, `/sign-up`.
  A session-cookie + `proxy.ts` path was scaffolded and then rolled back for
  now because it needs `firebase-admin`; it will return in Slice 8.
- Last clean `npm run build` from `next-js/dorodoro` passed.

## Slice 1 — Settings page + RTDB sync

Status: Done.

Landed:

- [lib/firebase/database.ts](../next-js/dorodoro/lib/firebase/database.ts)
  returns the client `Database` off the shared Firebase app.
- [lib/settings/settings.ts](../next-js/dorodoro/lib/settings/settings.ts)
  owns defaults, the RTDB path `users/{uid}/settings`, normalize/read
  helpers, load (with legacy-key migration fallback), save, and the
  `localStorage` preview cache.
- [lib/settings/use-settings.ts](../next-js/dorodoro/lib/settings/use-settings.ts)
  hook: loads on mount off the auth user, tracks `loading | ready | error`,
  exposes `save(next)` and `isSaving`.
- [app/components/settings-form.tsx](../next-js/dorodoro/app/components/settings-form.tsx)
  is a controlled form: sliders clamp to their configured min/max, a live
  readout shows `value unit`, reset-to-defaults, submit disabled until
  dirty, success / error / info notice surface.
- [app/settings/page.tsx](../next-js/dorodoro/app/settings/page.tsx)
  simplified to the page shell + `<SettingsForm />`. Migration note
  removed.
- New `.settings-notice` styles in
  [app/globals.css](../next-js/dorodoro/app/globals.css).
- `npm run build` in `next-js/dorodoro` passes.

Deferred:

- Profile editing modal → Slice 6.
- Slider tooltip JS → not porting (kept legacy CSS only).

## Slice 2 — Timer + session persistence on `/start`

Status: Done.

Landed:

- Pure timer state machine in
  [lib/timer/timer-state.ts](../next-js/dorodoro/lib/timer/timer-state.ts)
  plus types / constants in
  [lib/timer/timer-types.ts](../next-js/dorodoro/lib/timer/timer-types.ts).
  Durations derive from the settings slice so changes in `/settings`
  propagate to an idle timer automatically.
- [lib/timer/use-timer.ts](../next-js/dorodoro/lib/timer/use-timer.ts)
  wraps the state machine with a `requestAnimationFrame` tick loop,
  absolute-deadline recovery (`timerEndsAtMs` + `started`) via
  localStorage, focus + visibility reconciliation, and auto-finalization
  when a backgrounded timer expires.
- Session completion logs append to
  `users/{uid}/completedSessions` and bump `users/{uid}/stats` through a
  transaction — see
  [lib/analytics/completed-sessions.ts](../next-js/dorodoro/lib/analytics/completed-sessions.ts).
- Workspace sessions CRUD in
  [lib/sessions/sessions.ts](../next-js/dorodoro/lib/sessions/sessions.ts)
  with subscriptions and `ensureDefaultSession` bootstrap;
  [lib/sessions/use-sessions.ts](../next-js/dorodoro/lib/sessions/use-sessions.ts)
  exposes a live list, active id, and create / rename / archive / switch.
- UI: [app/components/timer-panel.tsx](../next-js/dorodoro/app/components/timer-panel.tsx)
  (controls, phase label, count, resume vs start detection) and
  [app/components/session-switcher.tsx](../next-js/dorodoro/app/components/session-switcher.tsx)
  (current session, inline rename, list, archive, new session).
- [app/start/page.tsx](../next-js/dorodoro/app/start/page.tsx) rewired
  around the two new components.
- New styles for sessions list, inline rename, archive action, and timer
  meta in [app/globals.css](../next-js/dorodoro/app/globals.css).
- `npm run build` passes.

Deferred:

- Browser notifications + alert sounds (Pomodoro / break / finish).
  Track as follow-up before Slice 7 retirement.
- Animated progress ring (legacy used `anime.js`). Kept CSS-only.
- Per-segment analytics (pomo vs sbreak vs lbreak records). Only the
  roll-up `completedSessions` record is logged for now.
- Celebration modal when the full set completes.
- Legacy `focusBoard` root-path migration into a `Default` session (only
  impacts accounts created before the sessions refactor).

## Slice 3 — Dashboard analytics on `/home`

Status: Not started.

Goal: Render the KPI strip and charts from `users/{uid}/completedSessions`
using `chart.js` + `react-chartjs-2` already in `package.json`.

Deliverables:

- `lib/analytics/kpis.ts` pure KPI aggregation (daily goal, streaks, totals
  by weekday, focus minutes by date).
- `useCompletedSessions()` hook subscribing to RTDB with lightweight cache.
- `/home` page with hero, KPI cards, daily goal progress, and at least one
  chart (weekly focus minutes).

Out of scope:

- Server-side rendering of dashboard data (Slice 8).

## Slice 4 — Notes (Tiptap), todos, workspace tabs

Status: Done.

Landed:

- Installed `@tiptap/react`, `@tiptap/starter-kit`, and `@tiptap/pm`.
- RTDB adapters:
  [lib/workspace/notes.ts](../next-js/dorodoro/lib/workspace/notes.ts)
  (single HTML doc per session at
  `users/{uid}/sessions/{sessionId}/notes`) and
  [lib/workspace/todos.ts](../next-js/dorodoro/lib/workspace/todos.ts)
  (push / update / delete under
  `users/{uid}/sessions/{sessionId}/todos`).
- [app/components/notes-editor.tsx](../next-js/dorodoro/app/components/notes-editor.tsx):
  Tiptap StarterKit editor with 800 ms debounced autosave, remote echo
  guard, cross-device `subscribeToNotes` sync, save-status pill,
  flush-on-unmount, and `immediatelyRender: false` for SSR safety.
- [app/components/todos-list.tsx](../next-js/dorodoro/app/components/todos-list.tsx):
  live list with add / toggle / delete and remaining-count header.
- [app/components/workspace-tabs.tsx](../next-js/dorodoro/app/components/workspace-tabs.tsx):
  Notes / Todos tab switcher replacing the migration placeholder on
  `/start`.
- Rewired [app/start/page.tsx](../next-js/dorodoro/app/start/page.tsx).
- New styles for tabs, editor surface, and todo rows in
  [app/globals.css](../next-js/dorodoro/app/globals.css).
- `npm run build` passes.

Deferred:

- Multi-column workspace (the legacy board allowed multiple notes + todo
  columns per session). Current slice models one notes panel + one todo
  list per session.
- Todo drag-to-reorder, priority badges, and due dates.
- Rich formatting toolbar (only Tiptap StarterKit keyboard shortcuts for
  now).

## Slice 5 — AI chat panel

Status: Done.

Landed:

- RTDB adapter
  [lib/chat/messages.ts](../next-js/dorodoro/lib/chat/messages.ts):
  `subscribeToChatMessages` (orderByChild+limitToLast(50)) and
  `pushUserMessage` under
  `users/{uid}/sessions/{sessionId}/aiChat/messages` + updatedAt bump.
- [lib/chat/use-session-chat.ts](../next-js/dorodoro/lib/chat/use-session-chat.ts):
  merges persisted + optimistic messages, streams NDJSON from the worker
  (`delta`, `error`, `done` signals), preserves a streaming buffer while
  the RTDB echo arrives, exposes `send`, `status`, `sending`, `streaming`.
  Worker URL comes from `NEXT_PUBLIC_WORKER_URL` (fallback
  `https://dorodoro-ai.dorodoro.workers.dev`).
- [app/components/chat-panel.tsx](../next-js/dorodoro/app/components/chat-panel.tsx):
  slide-over panel with FAB toggle, starter prompts when empty, streaming
  assistant bubble with caret, ESC-to-close, auto-growing textarea.
- Wired into [app/start/page.tsx](../next-js/dorodoro/app/start/page.tsx)
  (assistant card copy updated).
- Full chat styles (FAB, panel, bubbles, input, starters) appended to
  [app/globals.css](../next-js/dorodoro/app/globals.css).
- `npm run build` passes.

Deferred:

- `<doro-action>` parsing + handling (create_note / create_todo_list) and
  the action-result chips on assistant bubbles. Action blocks are stripped
  from the UI for now.
- Mobile `#assistant` route-hash behaviour (push/pop history so hardware
  back closes the panel).
- Context payload (pulling notes + todos into the worker request). Current
  call sends only `sessionId` + recent messages.
- Quota status pill after a `done` event.
- Markdown rendering inside assistant bubbles (legacy used a small
  custom renderer). Plain text + `white-space: pre-wrap` for this slice.

## Slice 6 — Profile editing and header menu parity

Status: Done.

Landed:

- [app/components/edit-profile-modal.tsx](../next-js/dorodoro/app/components/edit-profile-modal.tsx):
  React modal that updates Firebase Auth `displayName`
  (`updateProfile`), password (`updatePassword`), and queues an email
  change via `verifyBeforeUpdateEmail`. Re-auths password users with
  `reauthenticateWithCredential` when email or password changes.
  Google-provider accounts get password + email fields disabled since
  those live in Google. ESC and backdrop click close; notices render
  inline.
- [app/components/profile-card.tsx](../next-js/dorodoro/app/components/profile-card.tsx):
  account summary card on `/settings` with avatar initial, name, email,
  and an "Unverified" pill for unverified email accounts. Launches the
  modal.
- [app/settings/page.tsx](../next-js/dorodoro/app/settings/page.tsx)
  renders `<ProfileCard />` above the settings form.
- Profile + modal styles appended to
  [app/globals.css](../next-js/dorodoro/app/globals.css).
- `npm run build` passes.

Deferred:

- Header avatar dropdown (edit-profile shortcut from `<SiteHeader />`).
  Entry point lives on `/settings` for now.
- Avatar photo upload (requires Firebase Storage + cropper).
- Mirroring `displayName` to a RTDB `users/{uid}/profile` node. The Next
  client reads the Firebase Auth user directly, so no mirror is needed
  for parity.
- Account deletion / extended re-auth flows.

## Slice 7 — `/start` parity audit (desktop + mobile)

Status: In progress.

Audit landed 2026-04-23. Parity matrix captured below; each row is a
concrete sub-task tracked as 7.x.

### Parity matrix

Legend: ✅ matches, 🛠 in progress this slice, ⏳ deferred to a later
slice, ❌ not yet started.

| # | Area | Legacy behavior | Next status | Plan |
| --- | --- | --- | --- | --- |
| 7.1 | Timer visuals | SVG progress ring (`<circle>` + `stroke-dasharray` animated), "1 of 4" session dots | ✅ Ring + dots rendered, driven by `timeLeft / fullDuration` | ✅ Shipped |
| 7.2 | Mobile panel switcher | Sticky 3-segment pill (Workspace / Timer / Assistant) under 992 px, swaps which panel is visible via `data-mobile-view` | ✅ shadcn `ToggleGroup`; panels swap via `data-mobile-view` state | ✅ Shipped |
| 7.3 | Hide-workspace toggle | Button in desktop header + mobile timer actions; collapses side panel and shows a "Focus overview" pepper-illustration card | Assistant card always visible inline | 🛠 Add toggle, swap to overview card |
| 7.4 | Board tabs | User-created tabs per session, each typed `notes` or `todos`, with rename/delete/create dialog, title inline edit | ✅ Dynamic columns stored under `users/{uid}/sessions/{id}/board/columns` (metadata) + `/board/notes/{id}` + `/board/todos/{id}`; shadcn `Dialog` for create/rename, `AlertDialog` for delete | ✅ Shipped |
| 7.5 | Notes editor toolbar | Quill snow toolbar: Bold / Italic / Underline / ordered + bullet list / blockquote / link / clean / heading picker | ✅ Tiptap toolbar with shadcn `Toggle` buttons (Bold / Italic / Strike / Code / H1 / H2 / bullet / ordered / quote) | ✅ Shipped |
| 7.6 | AI chat — markdown | Custom light markdown renderer in assistant bubbles | ✅ `react-markdown` + `remark-gfm` + `rehype-sanitize` | ✅ Shipped |
| 7.7 | AI chat — `<doro-action>` | Parses `<doro-action>` blocks, dispatches `create_note` / `create_todo_list`, renders result chips under the bubble | Action blocks stripped; no execution | ⏳ Defer — needs notes/todos write APIs wired to `uid`, plan as 7.7 follow-up but not this slice |
| 7.8 | AI chat — context payload | Sends current notes summary + todos alongside each prompt | Sends only `sessionId` + recent messages | 🛠 Add lightweight context builder from RTDB |
| 7.9 | AI chat — quota + new-chat | Quota string after `done` event, "new chat" icon button resets thread | No quota UI, no reset | 🛠 Show quota in status line, add new-chat button (shadcn `Button` variant) |
| 7.10 | AI chat — mobile sheet | Full-width sheet with `#assistant` history hash; hardware back closes; hides mobile panel switcher when open | ✅ shadcn `Sheet` (side="right"); `#assistant` pushed on open, popped on back | ✅ Shipped |
| 7.11 | Reduced motion | `@media (prefers-reduced-motion: reduce)` disables panel slide + streaming cursor | ✅ Block added to `globals.css` | ✅ Shipped |
| 7.12 | Header profile menu | Avatar click opens popover with Edit profile + Sign out | Profile edit lives on `/settings` only | ⏳ Defer — implement with shadcn `DropdownMenu` in Slice 8 prep |
| 7.13 | Logout confirmation | Dialog before sign-out | Immediate sign-out | ⏳ Defer to 7.12 follow-up (shadcn `AlertDialog`) |
| 7.14 | Session switcher UI | Dropdown menu under the current session title; rename + archive inside the menu | ✅ shadcn `DropdownMenu` trigger, rename via shadcn `Dialog`, archive as destructive menu item | ✅ Shipped |
| 7.15 | Sub-360 px pills | Mobile switcher collapses to icon-only | ✅ Sub-360 breakpoint shrinks the `ToggleGroup` font | ✅ Shipped |

### In-scope for this slice

7.1, 7.2, 7.3, 7.5, 7.6, 7.8, 7.9, 7.10, 7.11, 7.15.

### Deferred (folded into a follow-up pass)

7.4 (multi-column board), 7.7 (`<doro-action>` runtime), 7.12 (profile
dropdown), 7.13 (logout confirm), 7.14 (sessions dropdown menu). These
either need a schema change (7.4, 7.7) or a coordinated shadcn menu
pass (7.12–7.14) better handled as its own slice.

### Landed

- Audit matrix above committed to the plan.
- **Shadcn/ui bootstrap**: installed the shadcn CLI and seeded
  `components/ui` with `alert-dialog`, `button`, `dialog`,
  `dropdown-menu`, `input`, `label`, `scroll-area`, `separator`,
  `sheet`, `textarea`, `toggle-group`, `toggle`. `components.json`,
  `lib/utils` (`cn`), and the `@tailwindcss/postcss` + `tw-animate-css`
  setup are in place. `app/globals.css` now imports `tailwindcss`,
  `tw-animate-css`, and `shadcn/tailwind.css`.
- **7.1 Timer visuals** —
  [app/components/timer-panel.tsx](../next-js/dorodoro/app/components/timer-panel.tsx)
  now renders the SVG progress ring (`RING_RADIUS = 150`, animated
  `stroke-dashoffset = RING_CIRCUMFERENCE * (1 - progress)`) and the
  pomo session dots (`done` / `active` states driven by
  `state.count - 1` and `durations.repetition`). Restart + Skip buttons
  use `↺` / `⤼` glyphs with aria-labels.
- **7.2 + 7.10 + 7.15 Mobile switcher + chat sheet** —
  [app/components/focus-layout.tsx](../next-js/dorodoro/app/components/focus-layout.tsx)
  wraps the three focus panels in a shadcn `ToggleGroup`
  (`Workspace / Timer / Assistant`) with sticky pill styling scoped by
  `.mobile-panel-switcher` CSS (plus the sub-360 px shrink already in
  `globals.css`). Panels swap via
  `data-mobile-view={workspace|timer|assistant}` on `.focus-layout`.
  The chat panel at
  [app/components/chat-panel.tsx](../next-js/dorodoro/app/components/chat-panel.tsx)
  is rebuilt on shadcn `Sheet` (`side="right"`, `sm:max-w-md`), with the
  FAB now a shadcn `Button size="icon-lg"` (Lucide `Sparkles`) and the
  composer using shadcn `Textarea` + `Button`. On mobile, opening the
  sheet pushes a `#assistant` history entry so hardware back closes the
  chat; popstate listens for the hash to drop and mirrors the state.
- **7.11 Reduced-motion guards** —
  [app/globals.css](../next-js/dorodoro/app/globals.css) now carries a
  `@media (prefers-reduced-motion: reduce)` block that disables the
  chat slide transition, the streaming-cursor animation, the session
  dot tween, the ring `stroke-dashoffset` tween, and the legacy
  edit-profile card animation (the Dialog primitive respects the user
  preference on its own).
- **Slice 6 refactor** — the edit-profile modal at
  [app/components/edit-profile-modal.tsx](../next-js/dorodoro/app/components/edit-profile-modal.tsx)
  is rebuilt on shadcn `Dialog` + `DialogHeader` / `DialogFooter`, with
  shadcn `Input`, `Label`, and `Button` throughout. The Firebase auth
  flow (`reauthenticateWithCredential` → `verifyBeforeUpdateEmail` +
  `updatePassword` + `updateProfile`) is unchanged. ESC + outside-click
  are now handled by the Dialog primitive.
- `npm run build` in `next-js/dorodoro` passes after each sub-task
  above (10 routes, static where applicable).
- **7.6 Chat markdown** — installed `react-markdown`, `remark-gfm`,
  `rehype-sanitize`. Assistant bubbles now render through
  `<AssistantMarkdown />` with GFM tables/strikethrough and
  rehype-sanitize. `stripActionBlocks()` runs before markdown parse.
  `.assistant-md` styles (paragraphs, lists, inline/block code,
  blockquotes, tables) appended to `app/globals.css`.
- **7.5 Notes toolbar** —
  [app/components/notes-editor.tsx](../next-js/dorodoro/app/components/notes-editor.tsx)
  gains a `<NotesToolbar />` row of shadcn `Toggle` + `Separator`
  primitives covering Bold / Italic / Strike / inline Code / H1 / H2 /
  bullet list / ordered list / blockquote, driven by Tiptap's
  `editor.isActive()` and `editor.chain().focus().toggle*().run()`.
  Re-renders on `selectionUpdate` + `transaction` so pressed state
  stays in sync with the cursor. Link / underline deferred (not in
  StarterKit; can be added with `@tiptap/extension-link` later).
- **Green start button** — primary `Start / Pause / Resume` no
  longer uses the shadcn `primary-pill` class; a scoped
  `.timer-card .start-button` rule in `globals.css` restores the
  legacy `#34d47a → #2ecc71` gradient + green drop shadow.
- **7.14 Session switcher UI** — rebuilt
  [app/components/session-switcher.tsx](../next-js/dorodoro/app/components/session-switcher.tsx)
  on shadcn `DropdownMenu`. The current-session button is the
  trigger (`Session` eyebrow + title + `ChevronDown`); the menu lists
  every session, then `Rename` (opens a shadcn `Dialog` with
  `Input`) and `Archive` (destructive item, disabled when only one
  session remains). A separate `+` icon `Button` creates a new
  session.
- **Todo priority + reorder (partial 7.4 parity)** — todos now
  carry a `priority: "low" | "medium" | "high"` field stored on
  `users/{uid}/sessions/{id}/todos/{id}`. The list renders a
  priority `<select>` pill + move-up / move-down `Button`s, and a
  `todo-priority-row--{priority}` class tints the left edge.
  `reorderTodos()` batches an `update()` to rewrite `order` for all
  items in one call. This keeps the existing single-list schema;
  multi-column dynamic tabs (legacy `focus-board` with per-session
  `columns`) remain as Slice 7.4.
- **7.4 Multi-column dynamic board tabs** —
  [app/components/workspace-tabs.tsx](../next-js/dorodoro/app/components/workspace-tabs.tsx)
  is now a dynamic board driven by
  [lib/workspace/board.ts](../next-js/dorodoro/lib/workspace/board.ts).
  Column metadata lives under
  `users/{uid}/sessions/{id}/board/columns/{colId}` as `{ title,
  type, order, createdAt, updatedAt }`. Content is stored per column:
  note HTML at `board/notes/{colId}`, todo items at
  `board/todos/{colId}/{todoId}`. `NotesEditor` and `TodosList` now
  accept an optional `columnId` prop that routes reads/writes to the
  column-scoped path (falls back to legacy `/notes` + `/todos` paths
  when no `columnId` is provided). The toolbar has a `+` `Button` that
  opens a shadcn `Dialog` with title + type selector, a pencil button
  that reopens the same dialog in rename mode, and a trash button that
  triggers a shadcn `AlertDialog` confirmation. Deleting a column
  removes both the metadata and the content subtree in parallel.

## Slice 8 — Retire legacy `public/` HTML

Status: Completed.

Goal: Retire the legacy static frontend after slices 1–7 reached parity,
remove obsolete hosting/build surfaces, and document the server env needed
by the Next.js app.

Deliverables:

- Remove legacy static app files and dead copy-build tooling.
- Remove Firebase Hosting deployment surface in favor of Vercel.
- Env docs for `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_DATABASE_URL`, and
  Firebase Admin credentials used by the Next.js server.

Out of scope:

- Removing the Cloudflare worker (Slice 9 decides).

## Slice 9 — Optional: server data access + worker collapse

Status: Not started. Requires explicit go-ahead.

Goal: Install `firebase-admin`, move chosen mutations to Route Handlers /
Server Actions, decide whether to retire the Cloudflare worker in favor of
`app/api/chat/route.ts`.

## Done log

- 2026-05-19: Slice 8 shipped. Legacy static HTML/scripts were retired,
  Firebase Hosting deployment was removed, root legacy build tooling was
  dropped, and env/deploy docs were aligned to the live Vercel-hosted
  `dorodoro/` app.
- 2026-04-23: Foundation landed; plan restructured into slices.
- 2026-04-23: Slice 1 shipped. Settings form reads and writes
  `users/{uid}/settings` via the client SDK, with legacy migration and
  localStorage cache. Admin-backed session cookie rolled back to unblock
  build; will come back in Slice 8.
- 2026-04-23: Slice 2 shipped. Timer state machine + RAF tick + recovery +
  completed-session logging, plus workspace sessions CRUD and switcher.
- 2026-04-23: Slice 3 shipped. `/home` now renders live KPIs, goal ring,
  7-day focus chart (Chart.js), at-a-glance stats, and recent-sessions
  list off `users/{uid}/completedSessions`.
- 2026-04-23: Slice 4 shipped. Tiptap notes editor and live todos list
  under `users/{uid}/sessions/{sessionId}`, wrapped in a Notes / Todos
  tab switcher on `/start`.
- 2026-04-23: Slice 5 shipped. `<ChatPanel />` slide-over on `/start`
  streams from the existing Cloudflare worker, merges optimistic +
  persisted messages from
  `users/{uid}/sessions/{sessionId}/aiChat/messages`.
- 2026-04-23: Slice 6 shipped. Edit-profile modal on `/settings`
  handles name / email (verify-before-update) / password changes, with
  re-auth for password users and Google-aware field locking.
