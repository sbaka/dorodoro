"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import { getAuthAccessState } from "@/lib/auth/access";
import { getFirebaseAuth } from "@/lib/firebase/client";

type AuthNotice = {
  tone: "error" | "success" | "info";
  text: string;
} | null;

type AuthContextValue = {
  user: User | null;
  status: "loading" | "authenticated" | "signed-out";
  notice: AuthNotice;
  setNotice: (notice: AuthNotice) => void;
  clearNotice: () => void;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "signed-out">(
    "loading",
  );
  const [notice, setNotice] = useState<AuthNotice>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();

    return onAuthStateChanged(auth, async (nextUser) => {
      setStatus("loading");

      if (!nextUser) {
        setUser(null);
        setStatus("signed-out");
        return;
      }

      const accessState = await getAuthAccessState(auth, nextUser);

      if (!accessState.allowed) {
        setNotice({
          tone: "error",
          text: "Verify your email address before signing in, or continue with Google.",
        });
        await signOut(auth).catch(() => {});
        setUser(null);
        setStatus("signed-out");
        return;
      }

      setUser(accessState.user ?? nextUser);
      setStatus("authenticated");
    });
  }, []);

  async function signOutUser() {
    await signOut(getFirebaseAuth());
    setUser(null);
    setStatus("signed-out");
    setNotice(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        notice,
        setNotice,
        clearNotice: () => setNotice(null),
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}