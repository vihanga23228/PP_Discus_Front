"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { QuizAttemptSummary } from "../lib/types";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AttemptsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [attempts, setAttempts] = useState<QuizAttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();

    api
      .attempts(controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setAttempts(list);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setError(cause instanceof Error ? cause.message : "Could not load your attempts.");
      });

    return () => controller.abort();
  }, [authLoading, user, router, pathname]);

  const completed = attempts?.filter((a) => a.completedAt) ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="paper-glow border-b border-rule">
          <div className="mx-auto max-w-4xl px-5 py-12">
            <h1 className="font-serif text-4xl font-semibold text-ink">Your attempts</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-ink-soft">
              Every paper you have finished, with the marks you earned.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-12">
          {error && (
            <div className="rounded-2xl border border-amber/30 bg-amber-wash/60 p-6 text-sm leading-6 text-ink-soft">
              {error}
            </div>
          )}

          {!error && !attempts && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-paper-dim" />
              ))}
            </div>
          )}

          {!error && attempts && completed.length === 0 && (
            <div className="rounded-2xl border border-rule bg-card p-10 text-center">
              <p className="font-serif text-xl text-ink">You have not finished a paper yet.</p>
              <p className="mt-2 text-sm text-ink-soft">
                Work through every question in a paper and your score lands here.
              </p>
              <Link
                href="/#papers"
                className="mt-6 inline-block rounded-full bg-teal-deep px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal"
              >
                Browse the papers
              </Link>
            </div>
          )}

          {completed.length > 0 && (
            <ul className="space-y-3">
              {completed.map((attempt) => {
                const pct = Math.round(attempt.scorePct);
                return (
                  <li
                    key={attempt.attemptId}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-card px-5 py-4 shadow-paper"
                  >
                    <div>
                      <p className="font-serif text-lg font-semibold text-ink">
                        {attempt.paperTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatDate(attempt.startedAt)} · {attempt.correctCount} of{" "}
                        {attempt.totalQuestions} questions fully correct
                      </p>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p className="font-serif text-xl font-semibold text-teal-deep">
                          {attempt.earnedMarks} / {attempt.totalMarks}
                        </p>
                        <p className="text-xs text-ink-faint">marks</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${
                          pct >= 50
                            ? "bg-verdict-true text-verdict-true-ink"
                            : "bg-verdict-false text-verdict-false-ink"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
