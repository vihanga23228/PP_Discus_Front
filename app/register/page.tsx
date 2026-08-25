"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthShell from "../components/AuthShell";
import FormField from "../components/FormField";
import GoogleSignInButton, { googleConfigured } from "../components/GoogleSignInButton";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

function RegisterForm() {
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function handleFailure(cause: unknown) {
    if (cause instanceof ApiError) {
      setError(cause.message);
      setFieldErrors(cause.fieldErrors ?? {});
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setFieldErrors({ confirm: "The two passwords do not match." });
      return;
    }

    setBusy(true);
    try {
      await register(username.trim(), email.trim().toLowerCase(), password);
      router.replace(nextPath);
    } catch (cause) {
      handleFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle(idToken: string) {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle(idToken);
      router.replace(nextPath);
    } catch (cause) {
      handleFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes a moment, and it keeps a record of every paper you sit."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={`/login${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            className="font-semibold text-teal-deep underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink"
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <FormField
          label="Username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="chamodi"
          minLength={3}
          maxLength={50}
          required
          value={username}
          error={fieldErrors.username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          minLength={6}
          required
          value={password}
          error={fieldErrors.password}
          hint="Use at least 6 characters."
          onChange={(e) => setPassword(e.target.value)}
        />

        <FormField
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Type it once more"
          required
          value={confirm}
          error={fieldErrors.confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-teal-deep px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink-faint"
        >
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>

      {googleConfigured && (
        <>
          <div className="my-7 flex items-center gap-4">
            <span className="h-px flex-1 bg-rule" />
            <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">or</span>
            <span className="h-px flex-1 bg-rule" />
          </div>
          <GoogleSignInButton onCredential={onGoogle} text="signup_with" />
        </>
      )}
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <RegisterForm />
    </Suspense>
  );
}
