import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";

const APP_NAME = "dorodoro-admin";
const ADMIN_DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ??
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
  "https://dorodoro-1234-default-rtdb.firebaseio.com";

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch (error) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.",
        { cause: error },
      );
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, " +
      "or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

function getAdminApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) {
    return existing;
  }

  const sa = loadServiceAccount();
  const projectId =
    "project_id" in sa ? (sa as { project_id: string }).project_id : sa.projectId;
  const clientEmail =
    "client_email" in sa
      ? (sa as { client_email: string }).client_email
      : sa.clientEmail;
  const privateKey =
    "private_key" in sa
      ? (sa as { private_key: string }).private_key
      : sa.privateKey;

  return initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL: ADMIN_DATABASE_URL,
    },
    APP_NAME,
  );
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDatabase(): Database {
  return getDatabase(getAdminApp());
}

export function _getRawAdminApp() {
  // Exposed for diagnostics/tests only.
  return getApp(APP_NAME);
}
