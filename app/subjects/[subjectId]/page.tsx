"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import { api } from "../../lib/api";
import type { Exam, Subject } from "../../lib/types";

export default function SubjectExamsPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = Number(params.subjectId);
  const validId = Number.isFinite(subjectId);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const error = validId ? loadError : "That subject link is not valid.";

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();

    Promise.all([
      api.subject(subjectId, controller.signal),
      api.examsBySubject(subjectId, controller.signal),
    ])
      .then(([subjectData, examList]) => {
        if (controller.signal.aborted) return;
        setSubject(subjectData);
        setExams(examList);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(cause instanceof Error ? cause.message : "Could not load this subject.");
      });

    return () => controller.abort();
  }, [subjectId, validId]);

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
              <span className="text-ink-soft">{subject?.name ?? "Subject"}</span>
            </nav>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-teal">
              Step 2 of 3 · choose an exam
            </p>
            <h1 className="mt-1 font-serif text-4xl font-semibold leading-tight text-ink">
              {subject?.name ?? (
                <span className="inline-block h-9 w-64 max-w-full animate-pulse rounded bg-paper-dim" />
              )}
            </h1>

            {subject?.description && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
                {subject.description}
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-12">
          {error && (
            <div className="rounded-2xl border border-amber/30 bg-amber-wash/60 p-6">
              <p className="font-serif text-lg font-semibold text-ink">
                We could not load this subject
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{error}</p>
              <Link
                href="/"
                className="mt-4 inline-block text-sm font-semibold text-teal-deep underline underline-offset-4"
              >
                Back to home
              </Link>
            </div>
          )}

          {!error && !exams && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-paper-dim" />
              ))}
            </div>
          )}

          {exams && exams.length === 0 && (
            <p className="rounded-2xl border border-rule bg-card p-10 text-center text-ink-soft">
              No exams have been added to this subject yet.
            </p>
          )}

          {exams && exams.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {exams.map((exam) => (
                <article
                  key={exam.id}
                  className="group relative flex flex-col rounded-2xl border border-rule bg-card p-6 shadow-paper transition hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-lift"
                >
                  <span className="inline-flex w-fit rounded-full bg-teal-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal">
                    Exam
                  </span>

                  <h2 className="mt-3 font-serif text-xl font-semibold text-ink">
                    <Link href={`/exams/${exam.id}`} className="after:absolute after:inset-0">
                      {exam.title}
                    </Link>
                  </h2>

                  {exam.description && (
                    <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">
                      {exam.description}
                    </p>
                  )}

                  <p className="mt-5 text-xs text-ink-faint">
                    {exam.paperCount} {exam.paperCount === 1 ? "year" : "years"} ·{" "}
                    {exam.questionCount} questions
                  </p>

                  <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep">
                    Choose a year
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
