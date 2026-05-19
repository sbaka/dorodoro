This is the active DoroDoro app. It lives in `dorodoro`, runs on Next.js, deploys to Vercel, and still uses Firebase for auth + Realtime Database.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Copy `.env.example` to `.env` and fill in the Firebase, Resend, and Worker variables before testing auth or AI routes.

## Build

```bash
npm run build
```

## Deploy on Vercel

This folder is already linked locally to the Vercel project `dorodoro`.

Pull project settings and deploy from this directory:

```bash
npx vercel pull --yes
npx vercel deploy
```

Deploy production explicitly with:

```bash
npx vercel deploy --prod
```

If the Vercel dashboard is connected at repository level, set the project's Root Directory to `dorodoro`.

## Firebase and Worker

- Firebase Hosting is no longer used for the frontend deployment.
- Firebase still backs auth and Realtime Database access.
- The AI routes proxy to the Cloudflare Worker configured by `WORKER_URL` and `WORKER_SHARED_SECRET`.
