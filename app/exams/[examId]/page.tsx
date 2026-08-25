"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import { api } from "../../lib/api";
import type { Exam, Paper } from "../../lib/types";

export default function ExamPapersPage() {
  const params = useParams<{ examId: string }>();
  const examId = Number(params.examId);

  // A bad id in the URL is knowable during render — no effect needed
  const validId = Number.isFinite(examId);

  const [exam, setExam] = useState<Exam | null>(null);
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const error = validId ? loadError : "That exam link is not valid.";

  useEffect(() => {
    if (!validId) return;

    const controller = new AbortController();

    Promise.all([api.exam(examId, controller.signal), api.papers(examId, controller.signal)])
      .then(([examData, paperList]) => {
        if (controller.signal.aborted) return;
        setExam(examData);
        setPapers(paperList.slice().sort((a, b) => (b.year ?? 0) - (a.year ?? 0)));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(cause instanceof Error ? cause.message : "Could not load this exam.");
      });

    return () => controller.abort();
  }, [examId, validId]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="paper-glow border-b border-rule">
          <div className="mx-auto max-w-5xl px-5 py-12">
            <nav aria-label="Breadcrumb" className="text-sm text-ink-faint">
              <Link href="/" className="transition hover:text-teal-deep">
                Home
              </Link>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              {exam?.subjectId ? (
                <>
                  <Link
                    href={`/subjects/${exam.subjectId}`}
                    className="transition hover:text-teal-deep"
                  >
                    {exam.subjectName}
                  </Link>
                  <span className="mx-2" aria-hidden="true">
                    /
                  </span>
                </>
              ) : null}
              <span className="text-ink-soft">{exam?.title ?? "Exam"}</span>
            </nav>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-teal">
              Step 3 of 3 · choose a year
            </p>
            <h1 className="mt-1 font-serif text-4xl font-semibold leading-tight text-ink">
              {exam?.title ?? <span className="inline-block h-9 w-80 max-w-full animate-pulse rounded bg-paper-dim" />}
            </h1>

            {exam?.description && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">{exam.description}</p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="font-serif text-2xl font-semibold text-ink">Select a year</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Papers are listed newest first. Opening one requires a signed-in account.
          </p>

          {error && (
            <div className="mt-8 rounded-2xl border border-amber/30 bg-amber-wash/60 p-6">
              <p className="font-serif text-lg font-semibold text-ink">We could not load the papers</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{error}</p>
              <Link
                href="/"
                className="mt-4 inline-block text-sm font-semibold text-teal-deep underline underline-offset-4"
              >
                Back to home
              </Link>
            </div>
          )}

          {!error && !papers && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-paper-dim" />
              ))}
            </div>
          )}

          {papers && papers.length === 0 && (
            <p className="mt-8 rounded-2xl border border-rule bg-card p-8 text-center text-ink-soft">
              No papers have been added to this exam yet.
            </p>
          )}

          {papers && papers.length > 0 && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {papers.map((paper) => (
                <article
                  key={paper.id}
                  className="group relative flex flex-col rounded-2xl border border-rule bg-card p-6 shadow-paper transition hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-lift"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-4xl font-semibold text-teal-deep">
                      {paper.year ?? "—"}
                    </span>
                    <span className="rounded-full bg-teal-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal">
                      {paper.questionCount} questions
                    </span>
                  </div>

                  <h3 className="mt-3 font-serif text-xl font-semibold text-ink">
                    <Link
                      href={`/exams/${examId}/papers/${paper.id}`}
                      className="after:absolute after:inset-0"
                    >
                      {paper.title}
                    </Link>
                  </h3>

                  {paper.description && (
                    <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">
                      {paper.description}
                    </p>
                  )}

                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep">
                    Open the discussion
                    <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
