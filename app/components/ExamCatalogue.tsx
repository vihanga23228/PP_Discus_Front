"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, IS_REMOTE_API } from "../lib/api";
import type { Exam, Paper } from "../lib/types";

interface ExamWithPapers extends Exam {
  papers: Paper[];
}

function Skeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
          <div className="h-3 w-24 animate-pulse rounded bg-paper-dim" />
          <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-paper-dim" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-paper-dim" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-paper-dim" />
          <div className="mt-6 flex gap-2">
            <div className="h-8 w-20 animate-pulse rounded-full bg-paper-dim" />
            <div className="h-8 w-20 animate-pulse rounded-full bg-paper-dim" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExamCatalogue() {
  const [exams, setExams] = useState<ExamWithPapers[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const list = await api.exams(controller.signal);
        const withPapers = await Promise.all(
          list.map(async (exam) => ({
            ...exam,
            papers: await api.papers(exam.id, controller.signal).catch(() => [] as Paper[]),
          })),
        );
        if (!controller.signal.aborted) setExams(withPapers);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load the exam list.");
      }
    })();

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-amber/30 bg-amber-wash/60 p-6">
        <p className="font-serif text-lg font-semibold text-ink">The paper list is unavailable</p>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{error}</p>
        {IS_REMOTE_API ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-teal-deep px-5 py-2 text-sm font-semibold text-paper transition hover:bg-teal"
          >
            Try again
          </button>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">
            If you are running this locally, start the API with{" "}
            <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[13px] text-teal-deep">
              .\gradlew.bat bootRun
            </code>{" "}
            inside <span className="font-mono text-[13px]">pp_backen</span>.
          </p>
        )}
      </div>
    );
  }

  if (!exams) return <Skeleton />;

  if (exams.length === 0) {
    return (
      <div className="rounded-2xl border border-rule bg-card p-8 text-center">
        <p className="font-serif text-lg text-ink">No papers have been published yet.</p>
        <p className="mt-2 text-sm text-ink-soft">Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {exams.map((exam) => (
        <article
          key={exam.id}
          className="group relative flex flex-col rounded-2xl border border-rule bg-card p-6 shadow-paper transition hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-lift"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-teal-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal">
              Exam
            </span>
            <span className="text-xs text-ink-faint">
              {exam.paperCount} {exam.paperCount === 1 ? "paper" : "papers"}
            </span>
          </div>

          <h3 className="mt-4 font-serif text-2xl font-semibold leading-snug text-ink">
            <Link href={`/exams/${exam.id}`} className="after:absolute after:inset-0">
              {exam.title}
            </Link>
          </h3>

          {exam.description && (
            <p className="mt-3 text-sm leading-6 text-ink-soft">{exam.description}</p>
          )}

          {exam.papers.length > 0 && (
            <div className="relative z-10 mt-6 flex flex-wrap gap-2 pt-5 [border-top:1px_solid_var(--color-rule)]">
              {exam.papers
                .slice()
                .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
                .map((paper) => (
                  <Link
                    key={paper.id}
                    href={`/exams/${exam.id}/papers/${paper.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-3 py-1.5 text-sm font-semibold text-teal-deep transition hover:border-teal hover:bg-teal-wash"
                  >
                    {paper.year ?? paper.title}
                    <span className="text-xs font-normal text-ink-faint">
                      {paper.questionCount} Q
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
