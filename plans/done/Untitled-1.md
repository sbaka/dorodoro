# Session-Based AI Chat Integration for DoroDoro

## Context

DoroDoro currently has a single flat focus board (columns of notes + todos) shared across a user's entire account. The user wants to restructure the app around **work sessions** — long-lived project/workspace containers (e.g. "Q2 Planning", "Thesis writing") that each bundle their own notes, todos, AI chat thread, and pomodoro statistics. Users will see a list of sessions, switch between them, create new ones, or resume where they left off. The AI is scoped to the active session: its context is that session's notes, todos and prior chat — not the user's entire history.

This must work as a multi-user webapp with per-user rate limits so no one can abuse the AI endpoint. No active users today, so credit-card-free infra is preferred. No unit tests.

Outcome: a sessions sidebar for browsing/creating/switching sessions, a session-scoped focus board (replacing the current global one via migration), a session-scoped AI chat panel backed by a Cloudflare Worker proxy to Gemini 2.0 Flash with rate limits enforced in RTDB.

## Architecture

```
Browser
  ├─ Sessions UI: list, create, rename, archive, switch
  │    └─ writes users/{uid}/activeSessionId
  ├─ Focus board re-mounts on session switch, reading
  │    users/{uid}/sessions/{sessionId}/focusBoard
  ├─ Pomodoro timer writes events with sessionId attribution
  └─ AI chat panel (scoped to active session)
       ├─ firebase.auth().currentUser.getIdToken()  →  Bearer <jwt>
       ├─ builds context: session's notes + todos + session stats + recent chat
       └─ POST https://dorodoro-ai.<sub>.workers.dev/chat { sessionId, messages, context }

Cloudflare Worker
  ├─ verify Firebase ID token (RS256, JWKS cached 1h)
  ├─ rate-limit in RTDB (per-user daily/monthly + global daily, via admin REST)
  ├─ assemble prompt, cap payload at 200KB
  ├─ stream from Gemini 2.0 Flash
  └─ write assistant message to users/{uid}/sessions/{sessionId}/aiChat/messages
```

Key decisions (locked in):
- **Session model**: work session / project, long-lived, many per user.
- **Board is per-session**: switching session swaps the board.
- **Chat is per-session**: each session has its own thread; AI context = that session only.
- **Timer attributes to active session**: `events/{eventId}` gains a `sessionId` field.
- **Backend**: Cloudflare Workers (free, no CC).
- **LLM**: Gemini 2.0 Flash (free, 1M context).
- **Limits**: 50/day, 500/month per user; global 1,000/day.
- **Chat UI**: right-side slide-over on `start.html` and `home.html`.

## Data Model (Firebase RTDB)

```
users/{uid}/
  activeSessionId: string                      # currently active session

  sessions/{sessionId}/
    title: string                              # "Q2 Planning"
    description: string (optional)
    status: "active" | "paused" | "done"
    createdAt, updatedAt: timestamp
    archivedAt: timestamp (optional)

    focusBoard/
      updatedAt: timestamp
      columns: [ ... same shape as today's users/{uid}/focusBoard ... ]

    aiChat/
      updatedAt: timestamp
      messages/{msgId}/
        role: "user" | "assistant"
        content: string
        createdAt: timestamp
        tokensIn, tokensOut                    # written by Worker

    stats/                                     # aggregated lazily from events
      totalPomos: int
      totalFocusSec: int
      totalCompleted: int
      lastFocusAt: timestamp

  events/{eventId}/                            # existing; add sessionId
    startedAt, endedAt, plannedSec, actualSec
    type: "pomo" | "sbreak" | "lbreak"
    completed, skipped
    subject: string | null
    sessionId: string                          # NEW — links pomo runs to session

  statsDaily/{YYYY-MM-DD}/                     # unchanged (global)
    pomos, focusSec, completed, skipped

aiLimits/
  global/{YYYY-MM-DD}/count: int               # 1000
  users/{uid}/
    daily/{YYYY-MM-DD}/count: int              # 50
    monthly/{YYYY-MM}/count: int               # 500
    lastRequestAt: timestamp                   # 3s cooldown
```

Security rules (`database.rules.json`):
- `users/{uid}/**` — read/write only when `auth.uid === $uid`.
- `aiLimits/users/{uid}/**` — read `auth.uid === $uid`, write `false` (Worker's admin token only).
- `aiLimits/global/**` — read/write `false` for clients.

### Migration (one-off, runs on first load after deploy)

If `users/{uid}/focusBoard` exists and `users/{uid}/sessions` is empty:
1. Create `users/{uid}/sessions/{newId}/` with `title: "Default"`, `status: "active"`.
2. Copy `users/{uid}/focusBoard` → `users/{uid}/sessions/{newId}/focusBoard`.
3. Set `users/{uid}/activeSessionId = newId`.
4. Delete old `users/{uid}/focusBoard` after successful copy.

Existing `events/` without `sessionId` are left as-is (unattributed historical data).

## Files to Create / Modify

### Create

- `worker/wrangler.toml` — secrets: `GEMINI_API_KEY`, `FIREBASE_SA_JSON`, `FIREBASE_PROJECT_ID`, `RTDB_URL`. CORS allow-list: hosting domain + `localhost`.
- `worker/src/index.js` — routes: `POST /chat`, `GET /quota`, `GET /chats/:sessionId`.
- `worker/src/auth.js` — Firebase ID token verifier (RS256, JWKS cache via Workers Cache API).
- `worker/src/rateLimit.js` — admin-token-signed RTDB REST calls for atomic limit increments. Order: cooldown → user daily → user monthly → global. Rollback on Gemini 5xx.
- `worker/src/gemini.js` — prompt builder + streaming wrapper around `gemini-2.0-flash:streamGenerateContent`. Injects `[SESSION CONTEXT]` block containing title, notes text, todos, session stats, recent chat.
- `public/scripts/sessions.js` — `window.Sessions` IIFE:
  - `list()`, `create(title)`, `rename(id, title)`, `archive(id)`, `setActive(id)`, `getActive()`, `onActiveChanged(cb)`.
  - Handles migration from legacy flat `focusBoard` path.
  - Emits a custom event `sessions:active-changed` so the focus board and chat can re-mount.
- `public/scripts/ai-chat.js` — `window.AIChat` IIFE. Builds context blob from `window.FocusBoard` + `window.Sessions.getActive()` + recent chat messages. Streams Gemini response via `fetch` + `ReadableStream`. Persists user messages immediately; assistant message also written server-side by Worker but client writes give instant UI.
- `public/styles/ai-chat.css` — slide-over panel + bubbles using existing CSS variables.
- `public/styles/sessions.css` — sessions sidebar/picker styles.

### Modify

- `public/scripts/board.js`:
  - Refactor `boardState` loader to read/write `users/{uid}/sessions/{activeSessionId}/focusBoard` instead of `users/{uid}/focusBoard`.
  - Listen for `sessions:active-changed` → re-fetch and re-render columns.
  - Expose `window.FocusBoard.getNotesText()` (flatten Quill deltas → plain text) and `window.FocusBoard.getTodos()` for the AI context builder. Reuse existing delta walking from `textPreview` generation (~board.js:304).
- `public/scripts/timer.js` / `public/scripts/analytics.js`:
  - Read `users/{uid}/activeSessionId` at pomo start; write `sessionId` into `events/{eventId}`.
  - Expose `window.Analytics.getSessionStats(sessionId)` — aggregate `events` filtered by `sessionId` (or read the cached `sessions/{id}/stats` sub-node, updated via transaction when events are written).
- `public/start.html`:
  - Add sessions sidebar/list (reuses `.focus-side-panel` pattern at line 45 but as a top-level workspace switcher — consider a slim left rail of session tiles + "+" button).
  - Add active-session header/badge ("Currently: Q2 Planning") above the focus board.
  - Add AI chat FAB (bottom-right sparkle) + right slide-over panel markup.
  - `<link>` + `<script>` for new files.
- `public/home.html`:
  - Same AI chat FAB + panel (scoped to whatever session is active).
  - Dashboard stat cards: add a "By session" toggle using `getSessionStats()`.
- `public/scripts/firebase-db.js` — helpers for `activeSessionId` read/write; touch `updatedAt` on session edits.
- `database.rules.json` — create/update with rules above.
- `firebase.json` — wire `"database": { "rules": "database.rules.json" }`.
- `README.md` — add "Sessions & AI" section covering the data-model change, how to deploy the Worker (`wrangler deploy`), where to set Gemini + service-account secrets.

## Reused Existing Code

- `firebase.auth().currentUser.uid` + `getIdToken()` — pattern from `auth.js`.
- IIFE + `window.<Namespace>` module pattern (`window.FocusBoard`, `window.Dashboard`, `window.Analytics`) — `window.Sessions` and `window.AIChat` follow suit.
- `.dialog` / `.overlay` glass-morphism (`start.css:1594-1636`) — mirror for chat panel.
- `.focus-side-panel` layout (`start.html:45`) — basis for sessions sidebar + right-side chat panel.
- Quill delta walk for `textPreview` (~`board.js:304`) — factor out into `getNotesText()`.
- Existing `focusBoard` column shape is kept identical, just nested under a session — no column/card code changes needed beyond path rewiring.

## UX Flow

1. First load post-deploy: migration creates "Default" session from existing board; user sees their notes/todos unchanged, plus a new session indicator.
2. User clicks "+" on the sessions rail → prompt for title → new session created and made active → board becomes empty, chat thread starts fresh.
3. User clicks another session → board + chat swap to that session's contents.
4. User starts pomodoro → run is attributed to the active session; session stats update.
5. User opens AI chat → asks "what should I focus on today?" → Worker pulls that session's notes + todos + last ~20 chat messages + session stats, sends to Gemini, streams reply. Quota badge decrements.

## Verification (manual, no unit tests)

1. **Migration**: sign in with an existing account that has a populated `focusBoard` → confirm a "Default" session is created, `activeSessionId` is set, board renders identical content, legacy path is removed.
2. **Create + switch**: create two sessions "A" and "B", add distinct notes/todos in each, switch between them → board and chat swap correctly, no leakage.
3. **Chat scope**: in session A ask "list my todos" → response references only A's todos. Switch to B → chat history is different; responses reference B's todos.
4. **Timer attribution**: start active session A, run a pomodoro → `events/{id}.sessionId === A`. `sessions/A/stats.totalPomos` increments. `statsDaily` unchanged in behavior.
5. **Rate limit**: fire 51 rapid chat requests → 50 succeed, 51st returns 429 with `retryAfter`. Global cap test: simulate 2 users filling 1000 combined → next user gets `reason: "global_cap"`.
6. **Security**:
   - DevTools: send chat request with tampered uid/sessionId in body → Worker uses JWT uid and confirms session belongs to that uid, else 403.
   - Attempt direct client write to another user's `sessions/` path → denied by rules.
   - Attempt client write to `aiLimits/users/{uid}/...` → denied.
7. **Persistence**: reload page → active session persists, chat history loads, board renders from RTDB.
8. **Both pages**: open chat FAB on `home.html` → same thread as on `start.html` when the same session is active.
9. **Fallback**: invalidate Gemini key temporarily → UI shows "AI unavailable"; rate-limit counters do not increment on upstream 5xx (rollback verified by reading counter before/after).
10. **Deploy smoke**: `wrangler deploy`, update Worker URL in `ai-chat.js`, `firebase deploy --only hosting,database`, walk flows 1–4 end-to-end on the hosted domain.