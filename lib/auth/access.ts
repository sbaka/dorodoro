import { signOut, type Auth, type User } from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";

export type AuthAccessState = {
  allowed: boolean;
  reason: "allowed" | "signed-out" | "unverified-email";
  user: User | null;
};

export function isGoogleUser(user: User | null | undefined) {
  const providers = Array.isArray(user?.providerData) ? user.providerData : [];
  return providers.some((provider) => provider?.providerId === "google.com");
}

export async function getAuthAccessState(
  auth: Auth,
  user: User | null,
  options: { reload?: boolean } = {},
): Promise<AuthAccessState> {
  if (!user) {
    return {
      allowed: false,
      reason: "signed-out",
      user: null,
    };
  }

  let resolvedUser = user;

  if (options.reload !== false) {
    try {
      await user.reload();
      resolvedUser = auth.currentUser ?? getFirebaseAuth().currentUser ?? user;
    } catch {
      resolvedUser = auth.currentUser ?? user;
    }
  }

  const allowed = Boolean(resolvedUser.emailVerified) || isGoogleUser(resolvedUser);

  return {
    allowed,
    reason: allowed ? "allowed" : "unverified-email",
    user: resolvedUser,
  };
}

export async function ensureAllowedSession(
  auth: Auth,
  user: User,
  options: { message?: string } = {},
) {
  const accessState = await getAuthAccessState(auth, user);

  if (accessState.allowed) {
    return {
      user: accessState.user ?? user,
      error: null,
    };
  }

  await signOut(auth).catch(() => {});

  return {
    user: null,
    error:
      options.message ??
      "Verify your email address before signing in, or continue with Google.",
  };
}

export function getUserLabel(user: User | null) {
  if (!user) {
    return "Guest";
  }

  return user.displayName?.trim() || user.email?.trim() || "DoroDoro";
}

export function getUserInitial(user: User | null) {
  const value = getUserLabel(user).trim();
  return value ? value[0]!.toUpperCase() : "D";
}