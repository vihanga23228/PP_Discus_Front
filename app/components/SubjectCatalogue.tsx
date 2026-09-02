"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, IS_REMOTE_API } from "../lib/api";
import type { Subject } from "../lib/types";

function Skeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
          <div className="h-3 w-20 animate-pulse rounded bg-paper-dim" />
          <div className="mt-4 h-7 w-2/3 animate-pulse rounded bg-paper-dim" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-paper-dim" />
          <div className="mt-6 h-4 w-1/2 animate-pulse rounded bg-paper-dim" />
        </div>
      ))}
    </div>
  );
}

export default function SubjectCatalogue() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    api
      .subjects(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        // Only show subjects that actually have something to sit
        setSubjects(list.filter((s) => s.paperCount > 0));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load the subject list.");
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-amber/30 bg-amber-wash/60 p-6">
        <p className="font-serif text-lg font-semibold text-ink">The subject list is unavailable</p>
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

  if (!subjects) return <Skeleton />;

  if (subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-rule bg-card p-8 text-center">
        <p className="font-serif text-lg text-ink">No subjects have been published yet.</p>
        <p className="mt-2 text-sm text-ink-soft">Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {subjects.map((subject) => (
        <article
          key={subject.id}
          className="group relative flex flex-col rounded-2xl border border-rule bg-card p-6 shadow-paper transition hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-lift"
        >
          <span className="inline-flex w-fit rounded-full bg-teal-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal">
            Subject
          </span>

          <h3 className="mt-4 font-serif text-2xl font-semibold leading-snug text-ink">
            <Link href={`/subjects/${subject.id}`} className="after:absolute after:inset-0">
              {subject.name}
            </Link>
          </h3>

          {subject.description && (
            <p className="mt-3 flex-1 text-sm leading-6 text-ink-soft">{subject.description}</p>
          )}

          <dl className="mt-6 flex gap-6 border-t border-rule pt-4 text-sm">
            <div>
              <dt className="text-xs text-ink-faint">Exams</dt>
              <dd className="font-serif text-lg font-semibold text-teal-deep">
                {subject.examCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Papers</dt>
              <dd className="font-serif text-lg font-semibold text-teal-deep">
                {subject.paperCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Questions</dt>
              <dd className="font-serif text-lg font-semibold text-teal-deep">
                {subject.questionCount}
              </dd>
            </div>
          </dl>

          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep">
            Choose an exam
            <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
              &rarr;
            </span>
          </span>
        </article>
      ))}
    </div>
  );
}
