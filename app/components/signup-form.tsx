"use client";

import { useMemo, useState, type SVGProps } from "react";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { MailPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import {
  createGoogleProvider,
  getFirebaseAuth,
  getLoginActionUrl,
} from "@/lib/firebase/client";

const namePattern = /^[A-Za-z\s]{3,30}$/;
const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

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

function mapSignUpError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "Failed to create account. Please try again.";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/invalid-email":
      return "The email address is not valid.";
    case "auth/weak-password":
      return "Password is too weak. Please use a stronger password.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment, then try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled before it finished.";
    default:
      return "Failed to create account. Please try again.";
  }
}

function getPasswordStrength(password: string) {
  if (!password) {
    return { label: "Use at least 8 characters with letters and numbers", percent: 0 };
  }

  let strength = 0;

  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/[a-z]/.test(password)) strength += 10;
  if (/\d/.test(password)) strength += 20;
  if (/[^A-Za-z0-9]/.test(password)) strength += 20;

  if (strength < 40) {
    return { label: "Weak password", percent: strength };
  }

  if (strength < 70) {
    return { label: "Medium strength", percent: strength };
  }

  return { label: "Strong password", percent: strength };
}

export function SignupForm() {
  const auth = getFirebaseAuth();
  const router = useRouter();
  const { notice, clearNotice, setNotice } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, password: false });
  const [localNotice, setLocalNotice] = useState<InlineNotice>(null);
  const [submitMode, setSubmitMode] = useState<"form" | "google" | null>(null);

  const isSubmitting = submitMode !== null;

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const nameError = touched.name && !namePattern.test(name.trim())
    ? "Name must be 3-30 letters only."
    : "";
  const emailError = touched.email && !emailPattern.test(email.trim())
    ? "Please enter a valid email address."
    : "";
  const passwordError = touched.password && !passwordPattern.test(password)
    ? "Password must be at least 8 characters with letters and numbers."
    : "";

  const isFormValid =
    namePattern.test(name.trim()) &&
    emailPattern.test(email.trim()) &&
    passwordPattern.test(password);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotice();
    setTouched({ name: true, email: true, password: true });

    if (!isFormValid) {
      setLocalNotice({ tone: "error", text: "Please fix the errors before submitting." });
      return;
    }

    setSubmitMode("form");
    setLocalNotice(null);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      await updateProfile(credential.user, {
        displayName: name.trim(),
      });

      await sendEmailVerification(credential.user, {
        url: getLoginActionUrl(),
      });

      await auth.signOut();
      setNotice({
        tone: "success",
        text: "Account created. Check your inbox, verify your email, then sign in.",
      });
      router.replace("/login");
    } catch (error) {
      setLocalNotice({ tone: "error", text: mapSignUpError(error) });
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleGoogleSignIn() {
    clearNotice();
    setSubmitMode("google");
    setLocalNotice(null);

    try {
      await signInWithPopup(auth, createGoogleProvider());
      setNotice(null);
      router.replace("/home");
    } catch (error) {
      setLocalNotice({ tone: "error", text: mapSignUpError(error) });
    } finally {
      setSubmitMode(null);
    }
  }

  const activeNotice = localNotice ?? notice;

  return (
    <form className="auth-form-grid" onSubmit={handleSubmit}>
      {activeNotice ? (
        <div className={`auth-notice auth-notice-${activeNotice.tone}`} role="status">
          {activeNotice.text}
        </div>
      ) : null}

      <div className="auth-entry-stack">
        <button
          type="button"
          className="button secondary-pill auth-provider-button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <GoogleIcon className="auth-provider-icon" />
          <span>{submitMode === "google" ? "Opening Google..." : "Continue with Google"}</span>
        </button>
        <p className="auth-button-note">
          Create your account instantly and keep your sessions synced from the start.
        </p>
      </div>

      <div className="auth-divider" aria-hidden="true">
        <span>or create an account with email</span>
      </div>

      <label className="input-group">
        <span className="field-label">Name</span>
        <input
          className="input"
          type="text"
          placeholder="Name"
          autoComplete="name"
          value={name}
          onBlur={() => setTouched((current) => ({ ...current, name: true }))}
          onChange={(event) => setName(event.target.value)}
        />
        {nameError ? <span className="field-error">{nameError}</span> : null}
      </label>

      <label className="input-group">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          onChange={(event) => setEmail(event.target.value)}
        />
        {emailError ? <span className="field-error">{emailError}</span> : null}
      </label>

      <label className="input-group">
        <span className="field-label">Password</span>
        <input
          className="input"
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          value={password}
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          onChange={(event) => setPassword(event.target.value)}
        />
        {passwordError ? <span className="field-error">{passwordError}</span> : null}
        <div className="password-strength">
          <div className="strength-meter">
            <div
              className="strength-bar"
              style={{ width: `${passwordStrength.percent}%` }}
            />
          </div>
          <span>{passwordStrength.label}</span>
        </div>
      </label>

      <button
        type="submit"
        className="button primary-pill auth-submit-button"
        disabled={!isFormValid || isSubmitting}
      >
        <MailPlus className="auth-provider-icon" aria-hidden="true" />
        <span>{submitMode === "form" ? "Creating account..." : "Sign up with email"}</span>
      </button>

      <p className="form-note">
        Create your account to save sessions and return to your study rhythm at any time.
      </p>
      <p className="form-switch">
        Already a member? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}