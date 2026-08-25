"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QuizRunner from "../../../../components/QuizRunner";
import SiteHeader from "../../../../components/SiteHeader";
import { ApiError, api } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth";
import type { Paper, Question } from "../../../../lib/types";

function LoadingPaper() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-10">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-xl bg-paper-dim" />
      ))}
    </div>
  );
}

export default function PaperQuizPage() {
  const params = useParams<{ examId: string; paperId: string }>();
  const examId = Number(params.examId);
  const paperId = Number(params.paperId);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // A bad id in the URL is knowable during render — no effect needed
  const validIds = Number.isFinite(examId) && Number.isFinite(paperId);

  const [paper, setPaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const error = validIds ? loadError : "That paper link is not valid.";

  // Send signed-out visitors to log in, then straight back to this paper
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  useEffect(() => {
    if (authLoading || !user || !validIds) return;

    const controller = new AbortController();

    Promise.all([
      api.paper(examId, paperId, controller.signal),
      api.questionsByPaper(paperId, controller.signal),
    ])
      .then(([paperData, questionList]) => {
        if (controller.signal.aborted) return;
        setPaper(paperData);
        setQuestions(questionList);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setLoadError(cause instanceof Error ? cause.message : "Could not load this paper.");
      });

    return () => controller.abort();
  }, [authLoading, user, examId, paperId, validIds, router, pathname]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <LoadingPaper />
      </div>
    );
  }

  return (
    <div className="paper-grid flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1 px-5">
        <div className="mx-auto max-w-3xl">
          {/* Paper masthead */}
          <header className="border-b-2 border-teal-deep pb-3.5 pt-8">
            <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-faint">
              <Link href="/" className="transition hover:text-teal-deep">
                Home
              </Link>
              <span className="mx-1.5" aria-hidden="true">
                /
              </span>
              {paper?.subjectId ? (
                <>
                  <Link
                    href={`/subjects/${paper.subjectId}`}
                    className="transition hover:text-teal-deep"
                  >
                    {paper.subjectName}
                  </Link>
                  <span className="mx-1.5" aria-hidden="true">
                    /
                  </span>
                </>
              ) : null}
              <Link href={`/exams/${examId}`} className="transition hover:text-teal-deep">
                {paper?.examTitle ?? "Exam"}
              </Link>
              <span className="mx-1.5" aria-hidden="true">
                /
              </span>
              <span className="text-ink-soft">{paper?.title ?? "Paper"}</span>
            </nav>

            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-deep">
              {paper?.examTitle ?? "External Pharmacy Exam"}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {paper?.title ?? "Loading paper…"}
            </h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              {paper?.year ? `${paper.year} · ` : ""}
              {questions ? `${questions.length} questions · ` : ""}
              English &amp; Sinhala explanations
            </p>
          </header>

          {error && (
            <div className="my-10 rounded-2xl border border-amber/30 bg-amber-wash/60 p-6">
              <p className="font-serif text-lg font-semibold text-ink">
                We could not load this paper
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{error}</p>
              <Link
                href={`/exams/${examId}`}
                className="mt-4 inline-block text-sm font-semibold text-teal-deep underline underline-offset-4"
              >
                Back to the paper list
              </Link>
            </div>
          )}

          {!error && !questions && <LoadingPaper />}

          {!error && questions && questions.length === 0 && (
            <p className="my-16 rounded-2xl border border-rule bg-card p-8 text-center text-ink-soft">
              This paper does not have any questions yet.
            </p>
          )}
        </div>

        {!error && paper && questions && questions.length > 0 && (
          <QuizRunner paper={paper} questions={questions} />
        )}

        <p className="mx-auto max-w-3xl pb-12 text-center text-xs leading-5 text-ink-faint">
          Answers reflect standard UK/BNF-aligned pharmacology and physiology teaching used in Sri
          Lankan pharmacist training. A few items (for example exact mg cut-offs) can vary by source
          — cross-check anything you are unsure of against your course notes before the exam.
        </p>
      </main>
    </div>
  );
}
