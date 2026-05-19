import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyAHwYY5X50lv6eKNlvCqUGpve4zbIKU2bA",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "dorodoro-1234.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
    "https://dorodoro-1234-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "dorodoro-1234",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "dorodoro-1234.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "210359007345",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:210359007345:web:79bce9199af36c84a983d0",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-V17XVPC4KK",
};

export const EMAIL_LINK_STORAGE_KEY = "dorodoro.emailForSignIn";

export function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export function getLoginActionUrl() {
  if (typeof window === "undefined") {
    return "/login";
  }

  return new URL("/login", window.location.origin).toString();
}

export function getEmailActionSettings() {
  return {
    url: getLoginActionUrl(),
    handleCodeInApp: true,
  };
}