<div align="center">
<h1 align="center">
<img src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/ec559a9f6bfd399b82bb44393651661b08aaf7ba/icons/folder-markdown-open.svg" width="100" />
<br>DoroDoro</h1>
<h3>◦ Active Next.js app now lives at the repository root</h3>
<h3>◦ Developed with the software and tools below.</h3>

<p align="center">
<img src="https://img.shields.io/badge/Next.js-000000.svg?style&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style&logo=TypeScript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Firebase-FFCA28.svg?style&logo=Firebase&logoColor=black" alt="Firebase" />
<img src="https://img.shields.io/badge/Vercel-000000.svg?style&logo=Vercel&logoColor=white" alt="Vercel" />
<img src="https://img.shields.io/badge/Cloudflare-F38020.svg?style&logo=Cloudflare&logoColor=white" alt="Cloudflare" />
<img src="https://img.shields.io/badge/ESLint-4B32C3.svg?style&logo=ESLint&logoColor=white" alt="ESLint" />
<img src="https://img.shields.io/badge/JSON-000000.svg?style&logo=JSON&logoColor=white" alt="JSON" />
</p>
<img src="https://img.shields.io/github/license/sbaka/dorodoro?style&color=5D6D7E" alt="MIT License" />
<img src="https://img.shields.io/github/last-commit/sbaka/dorodoro?style&color=5D6D7E" alt="git-last-commit" />
<img src="https://img.shields.io/github/commit-activity/m/sbaka/dorodoro?style&color=5D6D7E" alt="GitHub commit activity" />
<img src="https://img.shields.io/github/languages/top/sbaka/dorodoro?style&color=5D6D7E" alt="GitHub top language" />
</div>

---

## 📖 Table of Contents

- [📖 Table of Contents](#-table-of-contents)
- [📍 Overview](#-overview)
- [📦 Features](#-features)
- [📂 Repository Structure](#-repository-structure)
- [📄 License](#-license)

---

## 📍 Overview

It is a project I did with a friend, she did the design and I coded the website. The intention was to simulate a Client/Developer experience and get as close to what the client wanted as possible.

The current app is a Next.js migration of the original static prototype. Vercel now hosts the frontend, Firebase still powers auth and Realtime Database, and a Cloudflare Worker handles the AI proxy.

![Screenshot of the first screen](image.png)

---

## 📦 Features

- The Pomodoro logic is quite simple to understand, but I tried adding some customization to give the end user more control and personalization.
- I played a little with animation to get that timer animation working and synching with the timer.
- The Firebase integration was quite straightforward although I faced some unusual errors but nothing was impossible.
- Getting the grasp over the Flexbox
- Small transition here and there

## Deployment

The active app is the Next.js project at the repository root.

- Hosting is now handled by Vercel.
- Firebase remains in use for auth and Realtime Database.
- Cloudflare Worker remains in use for the AI proxy.

### Vercel

The local Next.js directory is already linked to the Vercel project `dorodoro` through its local `.vercel/project.json` metadata.

Deploy or relink from the repository root:

```
npm install
npx vercel link
npx vercel pull --yes
npx vercel deploy
```

For production:

```
npx vercel deploy --prod
```

Set the project Root Directory in Vercel to the repository root.

Required Vercel environment variables are documented in `.env.example`.

### Firebase

Firebase Hosting has been removed from this repository. Firebase is still used for auth and Realtime Database, so only database rules should be deployed from the repo root.

```
firebase deploy --only database
```

## TODOS

This project isn't 100% done actually its not even fully usable as of now (10/10/2023):

- There are like 0 tests.
- It still needs more transitions and fluidity.
- There are some bugs here and there like when you skip all the pomos it doesn't restart.
- This website isn't responsive nor adaptive, It was developed for large 1080p screens and Chromium browsers.
- The auth isn't quite there either, there isn't enough logic or security except for the one provided by Firebase.

---

## 📂 Repository Structure

```sh
└── dorodoro/
   ├── app/                 # Next.js app router entrypoints
   ├── components/          # shared UI primitives and app components
   ├── lib/                 # Firebase, timer, settings, and workspace logic
   ├── public/              # PWA assets and static media
   ├── worker/              # Cloudflare Worker for AI routes
   ├── plans/               # migration tracking and implementation slices
   ├── firebase.json
   ├── database.rules.json
   └── README.md
```

---

## 🧠 Sessions & AI

DoroDoro is organized around **work sessions** — long-lived project containers that each own their own notes, todos, pomodoro stats, and AI chat thread. The sessions switcher lives above the focus board on the `/start` route; the AI assistant is a slide-over panel opened from the sparkle action inside the authenticated app.

### Data model (Firebase Realtime Database)

```
users/{uid}/
  activeSessionId
  sessions/{sessionId}/{ title, description, status, createdAt, updatedAt, archivedAt,
                         focusBoard/…, aiChat/messages/…, stats/… }
  events/{eventId}              # now carries sessionId
  statsDaily/{YYYY-MM-DD}
aiLimits/
  global/{YYYY-MM-DD}/count
  users/{uid}/{ daily/{YYYY-MM-DD}/count, monthly/{YYYY-MM}/count, lastRequestAt }
```

Rules are in [`database.rules.json`](database.rules.json). Deploy with:

```
firebase deploy --only database
```

On the first load after deploy, each signed-in user's legacy `users/{uid}/focusBoard` is migrated into a new "Default" session and the legacy path is removed.

### AI chat: Cloudflare Worker

The AI assistant streams through a Cloudflare Worker that verifies the Firebase ID token and enforces per-user + global rate limits in RTDB. The Next app calls the Worker from same-origin API routes, so browser traffic goes to `/api/ai/chat` instead of the Worker URL directly. All Worker code lives in [`worker/`](worker/).

Limits: **50/day, 500/month per user; 1,000/day global; 3s cooldown**.

#### One-time setup

1. **Create a Gemini API key**: https://aistudio.google.com/apikey
2. **Create a Firebase service account**: Firebase console → *Project settings* → *Service accounts* → *Generate new private key*. Keep the downloaded JSON safe.
3. **Install wrangler & sign in**:

   ```
   cd worker
   npm install
   npx wrangler login
   ```
4. **Set secrets** (run each from inside `worker/`):

   ```
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put FIREBASE_PROJECT_ID      # e.g. dorodoro-1234
   npx wrangler secret put RTDB_URL                  # e.g. https://dorodoro-1234-default-rtdb.firebaseio.com
   npx wrangler secret put FIREBASE_SA_JSON          # paste the entire service-account JSON (single line)
   npx wrangler secret put WORKER_SHARED_SECRET      # same value used by the Next app
   ```
5. **Update allowed CORS origins** in [`worker/wrangler.toml`](worker/wrangler.toml) (`ALLOWED_ORIGINS`) if your hosting domain isn't already listed.
6. **Deploy**:

   ```
   npx wrangler deploy
   ```

   Wrangler will print the Worker URL (e.g. `https://dorodoro-ai.<subdomain>.workers.dev`).
7. **Point the Next app at it**: set `WORKER_URL` and `WORKER_SHARED_SECRET` in the Next app environment. The Worker URL is server-only now and should not use a `NEXT_PUBLIC_` prefix.

#### Local development

```
cd worker
npx wrangler dev           # serves at http://localhost:8787
```

Set `WORKER_URL=http://localhost:8787` and the same `WORKER_SHARED_SECRET` in the Next app while developing. Direct browser-to-worker testing is only for local debugging.

#### Routes

| Route | Method | Auth | Description |
| --- | --- | --- | --- |
| `/chat` | POST | Firebase ID token | Streams an assistant reply (NDJSON). Body: `{ sessionId, messages, context }`. |
| `/quota` | GET | Firebase ID token | Returns the caller's current daily + monthly counts. |

Upstream Gemini 5xx failures trigger an automatic counter rollback so quota isn't burned on flaky days.

---

## 📄 License

This project is licensed under the `MIT License` License. See the [LICENSE-Type](LICENSE) file for additional info.

[↑ Return](#Top)
