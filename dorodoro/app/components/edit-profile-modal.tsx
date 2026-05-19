"use client";

import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth";

import { useAuth } from "@/app/components/auth-provider";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase/client";
import { getUserInitial, getUserLabel, isGoogleUser } from "@/lib/auth/access";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Notice = { tone: "error" | "success" | "info"; text: string } | null;

export function EditProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [signInMethods, setSignInMethods] = useState<string[] | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  const isGoogle = isGoogleUser(user);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user?.displayName ?? "");
    setEmail(user?.email ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setSignInMethods(null);
    setNotice(null);
  }, [open, user]);

  useEffect(() => {
    if (!open || !user?.email) return;

    let cancelled = false;
    setLoadingMethods(true);

    void fetchSignInMethodsForEmail(getFirebaseAuth(), user.email)
      .then((methods) => {
        if (!cancelled) {
          setSignInMethods(methods);
        }
      })
      .catch((error) => {
        console.error("Could not resolve sign-in methods:", error);
        if (!cancelled) {
          setSignInMethods([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMethods(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  if (!user) return null;

  const trimmedName = displayName.trim();
  const trimmedEmail = email.trim();
  const nameChanged = trimmedName !== (user.displayName ?? "").trim();
  const emailChanged =
    trimmedEmail.toLowerCase() !== (user.email ?? "").toLowerCase();
  const passwordChanged = newPassword.length > 0;
  const hasPasswordSignIn =
    signInMethods?.includes(EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD) ?? false;
  const needsReauth = hasPasswordSignIn && (emailChanged || passwordChanged);
  const canSetPassword = !loadingMethods && !hasPasswordSignIn;
  const isDirty = nameChanged || emailChanged || passwordChanged;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || saving) return;

    if (trimmedName.length > 0 && trimmedName.length < 2) {
      setNotice({ tone: "error", text: "Name needs at least 2 characters." });
      return;
    }
    if (passwordChanged && newPassword.length < 6) {
      setNotice({
        tone: "error",
        text: "New password must be at least 6 characters.",
      });
      return;
    }
    if (passwordChanged && loadingMethods) {
      setNotice({ tone: "error", text: "Still checking your sign-in options. Try again." });
      return;
    }
    if (passwordChanged && !hasPasswordSignIn && emailChanged) {
      setNotice({
        tone: "error",
        text: "Save your email change first, then add a password in a second step.",
      });
      return;
    }
    if (needsReauth && !currentPassword) {
      setNotice({
        tone: "error",
        text: "Enter your current password to change email or password.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const currentUser = user as User;
      const successMessages: string[] = [];

      if (needsReauth && currentUser.email) {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          currentPassword,
        );
        await reauthenticateWithCredential(currentUser, credential);
      }

      if (nameChanged) {
        await updateProfile(currentUser, { displayName: trimmedName });
        successMessages.push("Profile updated");
      }

      if (passwordChanged) {
        if (hasPasswordSignIn) {
          await updatePassword(currentUser, newPassword);
          successMessages.push("Password changed");
        } else {
          const emailForPassword = currentUser.email ?? trimmedEmail;
          if (!emailForPassword) {
            throw new Error("Add an email address before setting a password.");
          }

          if (isGoogle) {
            await reauthenticateWithPopup(currentUser, createGoogleProvider());
          }

          await linkWithCredential(
            currentUser,
            EmailAuthProvider.credential(emailForPassword, newPassword),
          );
          successMessages.push("Password added");
        }
      }

      let emailPending = false;
      if (emailChanged) {
        await verifyBeforeUpdateEmail(currentUser, trimmedEmail);
        emailPending = true;
        successMessages.push("Email change sent for confirmation");
      }

      await currentUser.reload();

      setNotice({
        tone: "success",
        text: emailPending
          ? "Saved. Check your new inbox to confirm the email change."
          : successMessages.length > 0
            ? `${successMessages.join(". ")}.`
            : "Profile updated.",
      });
      setCurrentPassword("");
      setNewPassword("");

      if (!emailPending) {
        setTimeout(() => onClose(), 900);
      }
    } catch (error) {
      setNotice({ tone: "error", text: friendlyAuthError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
              aria-hidden="true"
            >
              {getUserInitial(user)}
            </div>
            <div className="grid gap-0.5">
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>{getUserLabel(user)}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          id="edit-profile-form"
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ep-display-name">Display name</Label>
            <Input
              id="ep-display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              maxLength={60}
              placeholder="How should we greet you?"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ep-email">Email</Label>
            <Input
              id="ep-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={isGoogle}
            />
            {isGoogle ? (
              <small className="text-xs text-muted-foreground">
                Google accounts manage their email through Google.
              </small>
            ) : emailChanged ? (
              <small className="text-xs text-muted-foreground">
                We&apos;ll send a verification link to the new address. Your
                account email updates once you confirm it.
              </small>
            ) : null}
          </div>

          <>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-new-password">
                {canSetPassword ? "Add password" : "New password"}
              </Label>
              <Input
                id="ep-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={
                  canSetPassword
                    ? "Create a password for this account"
                    : "Leave blank to keep current"
                }
                minLength={6}
              />
              {loadingMethods ? (
                <small className="text-xs text-muted-foreground">
                  Checking which sign-in methods are already linked to this account.
                </small>
              ) : canSetPassword ? (
                <small className="text-xs text-muted-foreground">
                  Add a password so you can sign in without relying only on {isGoogle ? "Google" : "an email link"}.
                </small>
              ) : null}
            </div>

            {needsReauth && (
              <div className="grid gap-1.5">
                <Label htmlFor="ep-current-password">Current password</Label>
                <Input
                  id="ep-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Required to confirm changes"
                />
              </div>
            )}
          </>

          {notice && (
            <p
              className={
                notice.tone === "error"
                  ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  : notice.tone === "success"
                    ? "rounded-md border border-emerald-300/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                    : "rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
              }
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-profile-form"
            disabled={!isDirty || saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/requires-recent-login":
      return "Please sign out and back in with your current sign-in method, then try again.";
    case "auth/email-already-in-use":
      return "That email is already tied to another account.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/provider-already-linked":
      return "A password is already linked to this account.";
    case "auth/popup-closed-by-user":
      return "Google reauthentication was closed before it finished.";
    default:
      if (error instanceof Error) return error.message;
      return "Something went wrong. Please try again.";
  }
}
