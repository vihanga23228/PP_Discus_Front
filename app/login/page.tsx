"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthShell from "../components/AuthShell";
import FormField from "../components/FormField";
import GoogleSignInButton, { googleConfigured } from "../components/GoogleSignInButton";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

function LoginForm() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    setBusy(true);
    try {
      await login(username.trim(), password);
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
      title="Welcome back"
      subtitle="Sign in to open the past papers and pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link
            href={`/register${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            className="font-semibold text-teal-deep underline underline-offset-4"
          >
            Create an account
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
          label="Username or email"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="you@example.com"
          required
          value={username}
          error={fieldErrors.username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          value={password}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-teal-deep px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink-faint"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {googleConfigured && (
        <>
          <div className="my-7 flex items-center gap-4">
            <span className="h-px flex-1 bg-rule" />
            <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">or</span>
            <span className="h-px flex-1 bg-rule" />
          </div>
          <GoogleSignInButton onCredential={onGoogle} text="continue_with" />
        </>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <LoginForm />
    </Suspense>
  );
}
