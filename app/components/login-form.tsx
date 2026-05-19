"use client";

import { useEffect, useState, type SVGProps } from "react";
import { FirebaseError } from "firebase/app";
import {
  isSignInWithEmailLink,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
} from "firebase/auth";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { ensureAllowedSession } from "@/lib/auth/access";
import {
  EMAIL_LINK_STORAGE_KEY,
  createGoogleProvider,
  getFirebaseAuth,
} from "@/lib/firebase/client";

const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

type InlineNotice = {
  tone: "error" | "success" | "info";
  text: string;
} | null;

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M21.805 12.23c0-.68-.061-1.334-.174-1.962H12v3.708h5.502a4.706 4.706 0 0 1-2.04 3.087v2.565h3.305c1.936-1.782 3.038-4.406 3.038-7.398Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.074-.914 6.766-2.471l-3.305-2.565c-.914.613-2.083.975-3.46.975-2.657 0-4.908-1.793-5.713-4.204H2.872V16.38A10.22 10.22 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.287 13.735A6.14 6.14 0 0 1 5.967 11.8c0-.672.116-1.322.32-1.936V7.219H2.872A10.22 10.22 0 0 0 1.8 11.8c0 1.635.392 3.184 1.072 4.581l3.415-2.646Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.66c1.5 0 2.848.516 3.91 1.53l2.934-2.934C17.07 2.62 14.756 1.6 12 1.6a10.22 10.22 0 0 0-9.128 5.619l3.415 2.645C7.092 7.453 9.343 5.66 12 5.66Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function mapSignInError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "Failed to sign in. Please check your credentials.";
  }

  switch (error.code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "No account was found with that email and password.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-email":
      return "Use a valid email address to sign in.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled before it finished.";
    default:
      return "Failed to sign in. Please check your credentials.";
  }
}

function mapPasswordResetError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "Could not send the reset email right now. Try again in a moment.";
  }

  switch (error.code) {
    case "auth/invalid-email":
      return "Use a valid email address to reset your password.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Could not send the reset email right now. Try again in a moment.";
  }
}

function mapMagicLinkError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "Could not finish magic-link sign-in. Request a fresh link and try again.";
  }

  switch (error.code) {
    case "auth/invalid-email":
      return "That email does not match the one used for the magic link.";
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
    case "auth/user-token-expired":
      return "This magic link is no longer valid. Request a new one and try again.";
    case "auth/argument-error":
    case "auth/operation-not-allowed":
      return "Email-link sign-in needs to be enabled in Firebase Authentication before it can work here.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/missing-email":
      return "Enter the same email address you used for the magic link to finish signing in.";
    default:
      return "Could not finish magic-link sign-in. Request a fresh link and try again.";
  }
}

export function LoginForm() {
  const auth = getFirebaseAuth();
  const router = useRouter();
  const { notice, clearNotice, setNotice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localNotice, setLocalNotice] = useState<InlineNotice>(null);
  const [submitMode, setSubmitMode] = useState<"password" | "google" | null>(null);
  const [isMagicLinkBusy, setIsMagicLinkBusy] = useState(false);
  const [isResetBusy, setIsResetBusy] = useState(false);
  const [needsMagicLinkEmail, setNeedsMagicLinkEmail] = useState(false);

  const isSubmitting = submitMode !== null;

  useEffect(() => {
    let cancelled = false;

    async function completeMagicLinkSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        return;
      }

      let emailValue = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY) ?? email;

      if (!emailValue) {
        if (!cancelled) {
          setNeedsMagicLinkEmail(true);
          setLocalNotice({
            tone: "info",
            text: "Enter the same email address you used for the magic link to finish signing in.",
          });
        }
        return;
      }

      emailValue = emailValue.trim();
      if (!emailPattern.test(emailValue)) {
        if (!cancelled) {
          setNeedsMagicLinkEmail(true);
          setLocalNotice({
            tone: "info",
            text: "Enter the same email address you used for the magic link to finish signing in.",
          });
        }
        return;
      }

      const consumedKey = `${EMAIL_LINK_STORAGE_KEY}.consumed`;
      const alreadyConsumed = window.sessionStorage.getItem(consumedKey);
      if (alreadyConsumed === window.location.href) {
        return;
      }
      window.sessionStorage.setItem(consumedKey, window.location.href);

      if (!cancelled) {
        setNeedsMagicLinkEmail(false);
        setLocalNotice({ tone: "info", text: "Checking your magic link..." });
        setEmail(emailValue);
      }

      try {
        const credential = await signInWithEmailLink(auth, emailValue, window.location.href);
        const allowedSession = await ensureAllowedSession(auth, credential.user, {
          message:
            "That sign-in link did not produce a verified session. Use Google or request a new email link.",
        });

        if (!allowedSession.user) {
          if (!cancelled) {
            setLocalNotice({ tone: "error", text: allowedSession.error! });
          }
          return;
        }

        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);

        if (!cancelled) {
          setNeedsMagicLinkEmail(false);
          setNotice(null);
          setLocalNotice({
            tone: "success",
            text: "Magic link accepted. Redirecting to your dashboard...",
          });
          router.replace("/home");
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[magic-link] sign-in failed", error);
        }
        window.sessionStorage.removeItem(consumedKey);
        if (!cancelled) {
          setNeedsMagicLinkEmail(true);
          setLocalNotice({ tone: "error", text: mapMagicLinkError(error) });
        }
      }
    }

    void completeMagicLinkSignIn();

    return () => {
      cancelled = true;
    };
  }, [auth, email, router, setNotice]);

  function validateEmail() {
    const value = email.trim();

    if (!value) {
      setLocalNotice({ tone: "error", text: "Enter your email address first." });
      return null;
    }

    if (!emailPattern.test(value)) {
      setLocalNotice({ tone: "error", text: "Use a valid email address to continue." });
      return null;
    }

    return value;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotice();

    const emailValue = validateEmail();
    if (!emailValue) {
      return;
    }

    if (!password) {
      setLocalNotice({ tone: "error", text: "Email and password are required." });
      return;
    }

    setSubmitMode("password");
    setLocalNotice(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, emailValue, password);
      const allowedSession = await ensureAllowedSession(auth, credential.user);

      if (!allowedSession.user) {
        setLocalNotice({ tone: "error", text: allowedSession.error! });
        return;
      }

      setNotice(null);
      router.replace("/home");
    } catch (error) {
      setLocalNotice({ tone: "error", text: mapSignInError(error) });
    } finally {
      setSubmitMode(null);
    }
  }

  async function handlePasswordReset() {
    clearNotice();
    const emailValue = validateEmail();
    if (!emailValue) {
      return;
    }

    setIsResetBusy(true);
    setLocalNotice(null);

    try {
      await sendPasswordResetEmail(auth, emailValue);
      setLocalNotice({
        tone: "success",
        text: "If that email has an account, a reset link is on its way. Check your inbox and spam folder.",
      });
    } catch (error) {
      setLocalNotice({ tone: "error", text: mapPasswordResetError(error) });
    } finally {
      setIsResetBusy(false);
    }
  }

  async function handleMagicLink() {
    clearNotice();
    const emailValue = validateEmail();
    if (!emailValue) {
      return;
    }

    setIsMagicLinkBusy(true);
    setLocalNotice(null);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setLocalNotice({
          tone: "error",
          text:
            data?.error ??
            "Could not send the magic link right now. Try again in a moment.",
        });
        return;
      }

      window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, emailValue);
      setLocalNotice({
        tone: "success",
        text: "Magic link sent. Open it from your email to finish signing in.",
      });
    } catch (error) {
      setLocalNotice({ tone: "error", text: mapMagicLinkError(error) });
    } finally {
      setIsMagicLinkBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    clearNotice();
    setSubmitMode("google");
    setLocalNotice(null);

    try {
      const result = await signInWithPopup(auth, createGoogleProvider());
      const allowedSession = await ensureAllowedSession(auth, result.user, {
        message: "Google sign-in could not be verified. Try again.",
      });

      if (!allowedSession.user) {
        setLocalNotice({ tone: "error", text: allowedSession.error! });
        return;
      }

      setNotice(null);
      router.replace("/home");
    } catch (error) {
      setLocalNotice({ tone: "error", text: mapSignInError(error) });
    } finally {
      setSubmitMode(null);
    }
  }

  const activeNotice = localNotice ?? notice;

  return (
    <form className="auth-form-grid auth-form-grid-login" onSubmit={handleSubmit}>
      {activeNotice ? (
        <div className={`auth-notice auth-notice-${activeNotice.tone}`} role="status">
          {activeNotice.text}
        </div>
      ) : null}

      <div className="auth-entry-stack">
        <button
          type="button"
          className="button secondary-pill auth-provider-button auth-google-button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <GoogleIcon className="auth-provider-icon" />
          <span>{submitMode === "google" ? "Opening Google..." : "Continue with Google"}</span>
        </button>
        <p className="auth-button-note">
          Fastest way back into your timer, synced sessions, and saved progress.
        </p>
      </div>

      <div className="auth-divider" aria-hidden="true">
        <span>or sign in with email</span>
      </div>

      <label className="input-group">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={needsMagicLinkEmail ? true : undefined}
        />
      </label>

      <label className="input-group">
        <span className="field-row">
          <span className="field-label">Password</span>
          <button
            type="button"
            className="text-action field-action"
            onClick={handlePasswordReset}
            disabled={isResetBusy || isSubmitting}
          >
            {isResetBusy ? "Sending reset..." : "Forgot password?"}
          </button>
        </span>
        <div className="auth-password-field">
          <input
            className="input auth-password-input"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="text-action auth-password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            <span>{showPassword ? "Hide" : "Show"}</span>
          </button>
        </div>
      </label>

      <div className="auth-alt-card">
        <div className="auth-alt-copy">
          <p className="auth-alt-title">Prefer skipping the password?</p>
          <p className="auth-alt-body">
            Enter your email above and we will send a secure magic link instead.
          </p>
        </div>
        <button
          type="button"
          className="button secondary-pill auth-provider-button auth-magic-button"
          onClick={handleMagicLink}
          disabled={isMagicLinkBusy || isSubmitting}
        >
          <Mail className="auth-provider-icon" aria-hidden="true" />
          <span>{isMagicLinkBusy ? "Sending magic link..." : "Send me a magic link"}</span>
        </button>
      </div>

      <button
        type="submit"
        className="button primary-pill auth-submit-button"
        disabled={isSubmitting}
      >
        <LockKeyhole className="auth-provider-icon" aria-hidden="true" />
        <span>{submitMode === "password" ? "Signing in..." : "Sign in with password"}</span>
      </button>

      <p className="form-note">
        Use your account to sync your sessions and keep your progress in one place.
      </p>
      <p className="form-switch">
        Don&apos;t have an account? <Link href="/sign-up">Create one</Link>
      </p>
    </form>
  );
}
