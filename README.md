<div align="center">
<h1 align="center">
<img src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/ec559a9f6bfd399b82bb44393651661b08aaf7ba/icons/folder-markdown-open.svg" width="100" />
<br>DoroDoro</h1>
<h3>Pomodoro workspace with sessions, notes, analytics, and AI</h3>

<p align="center">
<img src="https://img.shields.io/badge/Next.js-000000.svg?style&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React-61DAFB.svg?style&logo=react&logoColor=061A23" alt="React" />
<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style&logo=TypeScript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Firebase-FFCA28.svg?style&logo=Firebase&logoColor=black" alt="Firebase" />
<img src="https://img.shields.io/badge/Vercel-000000.svg?style&logo=Vercel&logoColor=white" alt="Vercel" />
<img src="https://img.shields.io/badge/Cloudflare-F38020.svg?style&logo=Cloudflare&logoColor=white" alt="Cloudflare" />
</p>
<img src="https://img.shields.io/github/license/sbaka/dorodoro?style&color=5D6D7E" alt="MIT License" />
<img src="https://img.shields.io/github/last-commit/sbaka/dorodoro?style&color=5D6D7E" alt="Last commit" />
<img src="https://img.shields.io/github/commit-activity/m/sbaka/dorodoro?style&color=5D6D7E" alt="GitHub commit activity" />
<img src="https://img.shields.io/github/languages/top/sbaka/dorodoro?style&color=5D6D7E" alt="GitHub top language" />
</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Repository Structure](#repository-structure)
- [Sessions and AI](#sessions-and-ai)
- [Current Status](#current-status)
- [License](#license)

---

## Overview

DoroDoro is a study-focused Pomodoro app. The active application lives at the repository root and runs on Next.js with Firebase Auth, Firebase Realtime Database, and a Cloudflare Worker for AI requests.

The signed-in app is built around long-lived work sessions. Each session keeps its own timer state, notes, todos, analytics history, and assistant thread so you can switch between subjects or projects without losing context.

![Screenshot of the first screen](image.png)

## Features

- Public landing, about, privacy, and terms pages.
- Email/password, Google, reset-password, and magic-link sign-in flows.
- Customizable Pomodoro timer with persisted state, skip controls, and session history.
- Session switcher with per-session notes, todos, and AI chat history.
- Dashboard analytics for completed focus time and weekly progress.
- Settings hub with profile editing, synced timer preferences, assistant usage, data export, and account deletion.
- Server-side AI proxy through a Cloudflare Worker with per-user and global quotas.

## Local Development

Install dependencies from the repository root:

```bash
npm install
```

Create a local env file from [.env.example](.env.example) and fill in the required values for:

- Firebase web config
- Firebase Admin service account
- Resend email delivery
- Cloudflare Worker URL and shared secret

Start the Next.js app:

```bash
npm run dev
```

The app runs at `http://localhost:3000` by default.

If you want to work on the AI proxy locally, start the Worker in a second terminal:

```bash
cd worker
npm install
npx wrangler dev
```

Then set `WORKER_URL=http://localhost:8787` in your local app environment.

Useful root commands:

```bash
npm run dev
npm run lint
npm run build
```

## Deployment

### Vercel

The frontend is deployed from the repository root. This repo already contains local Vercel metadata for the `dorodoro` project.

```bash
npx vercel link
npx vercel pull --yes
npx vercel deploy
```

For a production deployment:

```bash
npx vercel deploy --prod
```

Set the Vercel project Root Directory to the repository root. Required environment variables are documented in [.env.example](.env.example).

### Firebase

Firebase Hosting is no longer used here. Firebase still handles auth and Realtime Database, so the deploy step from this repo is the database rules update:

```bash
firebase deploy --only database
```

### Cloudflare Worker

The Worker handles `/chat` and `/quota` for the assistant. One-time setup from [worker/](worker/):

1. Create a Gemini API key.
2. Create a Firebase service account JSON.
3. Sign in to Wrangler.
4. Set the Worker secrets.
5. Deploy with `npx wrangler deploy`.

Required Worker secrets:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put RTDB_URL
npx wrangler secret put FIREBASE_SA_JSON
npx wrangler secret put WORKER_SHARED_SECRET
```

After deploy, set `WORKER_URL` and `WORKER_SHARED_SECRET` in the Next.js app environment.

## Repository Structure

```text
dorodoro/
├── app/                 # App Router routes, API routes, and app components
├── components/ui/       # shared shadcn-style UI primitives
├── lib/                 # auth, settings, sessions, timer, analytics, chat, and RTDB helpers
├── public/              # static assets, PWA files, and service worker files
├── worker/              # Cloudflare Worker for AI streaming and quota checks
├── plans/               # migration and implementation notes
├── database.rules.json  # Firebase Realtime Database rules
├── firebase.json
├── package.json
└── README.md
```

## Sessions and AI

DoroDoro stores user data per session. A session owns its own notes, todos, focus history, and assistant conversation.

### Realtime Database shape

```text
users/{uid}/
   activeSessionId
   sessions/{sessionId}/{ title, description, status, createdAt, updatedAt, archivedAt,
                                     focusBoard/..., aiChat/messages/..., stats/... }
   events/{eventId}
   statsDaily/{YYYY-MM-DD}
aiLimits/
   global/{YYYY-MM-DD}/count
   users/{uid}/{ daily/{YYYY-MM-DD}/count, monthly/{YYYY-MM}/count, lastRequestAt }
```

Rules live in [database.rules.json](database.rules.json).

The browser never talks to the Worker directly in production. It calls Next.js API routes under `app/api/ai`, which forward the request after verifying the Firebase session and attaching the shared secret.

Current assistant limits:

- 50 requests per day per user
- 500 requests per month per user
- 1,000 requests per day globally
- 3 second cooldown between requests

Worker routes:

| Route | Method | Auth | Description |
| --- | --- | --- | --- |
| `/chat` | `POST` | Firebase ID token | Streams assistant output as NDJSON. |
| `/quota` | `GET` | Firebase ID token | Returns daily and monthly usage. |

## Current Status

The root Next.js app is the source of truth now. The main product surfaces are live:

- Landing and marketing pages
- Auth flows and email delivery
- Dashboard analytics
- Focus board with timer, notes, todos, and AI chat
- Settings, privacy tools, export, and account deletion

Automated tests are still missing, so the current workflow relies on linting, build checks, and manual validation.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
