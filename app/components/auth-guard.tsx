"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";

function AuthLoadingPanel({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="page-frame">
      <main className="auth-loading-shell surface-card">
        <p className="dash-eyebrow">Checking your session</p>
        <h1>{title}</h1>
        <p>{body}</p>
      </main>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status !== "authenticated") {
    return (
      <AuthLoadingPanel
        title="Opening your workspace"
        body="DoroDoro is checking your account before loading protected pages."
      />
    );
  }

  return <>{children}</>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/home");
    }
  }, [router, status]);

  if (status === "loading") {
    return (
      <AuthLoadingPanel
        title="Loading your account"
        body="Checking whether you already have an active DoroDoro session."
      />
    );
  }

  if (status === "authenticated") {
    return (
      <AuthLoadingPanel
        title="Redirecting"
        body="Your session is already active, so you are being sent to the dashboard."
      />
    );
  }

  return <>{children}</>;
}