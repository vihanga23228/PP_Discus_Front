"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../lib/api";
import type { DraftQuestion, Exam, ExtractionJob, ImportPaperResult, Subject } from "../../lib/types";

const NEW = "__new__";
const MEDIA_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8083").replace(/\/+$/, "");

function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${MEDIA_BASE}${path}`;
}

/* ------------------------------------------------------------------ review */

function QuestionRow({
  q,
  flagged,
  onChange,
}: {
  q: DraftQuestion;
  flagged: boolean;
  onChange: (next: DraftQuestion) => void;
}) {
  const answered = q.options.findIndex((o) => o.correct);

  return (
    <article
      className={`rounded-xl border p-4 ${
        flagged ? "border-amber/50 bg-amber-wash/40" : "border-rule bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-teal-deep px-2 py-0.5 text-[11px] font-bold text-white">
          Q{q.number}
        </span>
        <span className="flex items-center gap-2 text-[11px]">
          {q.truncated && (
            <span className="rounded bg-amber-wash px-1.5 py-0.5 font-semibold text-amber">
              spans a page break
            </span>
          )}
          {q.confidence && q.confidence !== "high" && (
            <span className="rounded bg-amber-wash px-1.5 py-0.5 font-semibold text-amber">
              {q.confidence} confidence
            </span>
          )}
          <span className={answered >= 0 ? "text-verdict-true-ink" : "text-verdict-false-ink"}>
            {answered >= 0 ? `answer ${q.options[answered].L}` : "no answer"}
          </span>
        </span>
      </div>

      <textarea
        rows={2}
        value={q.stem}
        onChange={(e) => onChange({ ...q, stem: e.target.value })}
        placeholder="Question (English)"
        className="mt-3 w-full rounded-lg border border-rule bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:bg-card"
      />
      <textarea
        rows={2}
        value={q.stem_si ?? ""}
        onChange={(e) => onChange({ ...q, stem_si: e.target.value || null })}
        placeholder="Question (Sinhala)"
        className="sinhala-note mt-1.5 w-full rounded-lg border border-rule bg-paper/60 px-3 py-2 text-sm outline-none focus:border-teal focus:bg-card"
      />

      {mediaUrl(q.image) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(q.image)!}
          alt={`Figure for question ${q.number}`}
          className="mt-2 max-h-52 rounded-lg border border-rule bg-white object-contain"
        />
      )}

      <ul className="mt-3 space-y-1.5">
        {q.options.map((o, i) => (
          <li key={i} className="flex items-start gap-2">
            <button
              type="button"
              title="Mark as the correct answer"
              onClick={() =>
                onChange({
                  ...q,
                  options: q.options.map((x, j) => ({ ...x, correct: j === i })),
                })
              }
              className={`mt-0.5 h-5 w-5 flex-none rounded-full border text-[10px] font-bold ${
                o.correct
                  ? "border-teal-deep bg-teal-deep text-white"
                  : "border-rule text-ink-faint hover:border-teal"
              }`}
            >
              {o.L}
            </button>
            <span className="min-w-0 flex-1">
              <input
                value={o.text}
                onChange={(e) =>
                  onChange({
                    ...q,
                    options: q.options.map((x, j) =>
                      j === i ? { ...x, text: e.target.value } : x,
                    ),
                  })
                }
                placeholder={`Option ${o.L} (English)`}
                className="w-full rounded border border-rule bg-paper/60 px-2 py-1 text-[13px] text-ink outline-none focus:border-teal focus:bg-card"
              />
              {(o.text_si || q.stem_si) && (
                <input
                  value={o.text_si ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      options: q.options.map((x, j) =>
                        j === i ? { ...x, text_si: e.target.value || null } : x,
                      ),
                    })
                  }
                  placeholder={`Option ${o.L} (Sinhala)`}
                  className="sinhala-note mt-1 w-full rounded border border-rule bg-paper/60 px-2 py-1 text-[13px] outline-none focus:border-teal focus:bg-card"
                />
              )}
              {mediaUrl(o.image) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(o.image)!}
                  alt={`Option ${o.L}`}
                  className="mt-1 max-h-28 rounded border border-rule bg-white object-contain"
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* -------------------------------------------------------------------- page */

export default function AdminPdfImportPage() {
  const [vision, setVision] = useState<boolean | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [useSample, setUseSample] = useState(false);
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answerKey, setAnswerKey] = useState("");
  const [subjectPick, setSubjectPick] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [examPick, setExamPick] = useState("");
  const [newExamTitle, setNewExamTitle] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [result, setResult] = useState<ImportPaperResult | null>(null);

  // catalogue + capabilities
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.admin.importCapabilities(controller.signal),
      api.subjects(controller.signal),
      api.exams(controller.signal),
    ])
      .then(([caps, s, e]) => {
        if (controller.signal.aborted) return;
        setVision(caps.vision);
        setUseSample(!caps.vision);
        setSubjects(s);
        setExams(e);
      })
      .catch(() => {
        if (!controller.signal.aborted) setVision(false);
      });
    return () => controller.abort();
  }, []);

  // poll a running job
  useEffect(() => {
    if (!job || job.status !== "RUNNING") return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      api.admin
        .extractionStatus(job.jobId, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setJob(next);
          if (next.status === "DONE") setDrafts(next.questions);
        })
        .catch(() => {});
    }, 2500);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [job]);

  const subjectChoice = subjectPick || (subjects.length > 0 ? String(subjects[0].id) : NEW);
  const subjectId = subjectChoice === NEW ? null : Number(subjectChoice);
  const examsInSubject = subjectId === null ? [] : exams.filter((e) => e.subjectId === subjectId);
  const examChoice = examPick || (examsInSubject.length > 0 ? String(examsInSubject[0].id) : NEW);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { jobId } = await api.admin.extractPdf(file, useSample);
      const first = await api.admin.extractionStatus(jobId);
      setJob(first);
      if (first.status === "DONE") setDrafts(first.questions);

      const yearMatch = file.name.match(/(19|20)\d{2}/);
      if (yearMatch) {
        if (!year) setYear(yearMatch[0]);
        if (!title) setTitle(`${yearMatch[0]} Paper`);
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That PDF could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  /** Applies a pasted marking scheme such as "5 1 5 1 3 …" or "51513…". */
  const applyKey = useCallback(() => {
    const digits = answerKey.match(/\d/g) ?? [];
    if (digits.length === 0) return;
    setDrafts((current) =>
      current.map((q, index) => {
        const pick = Number(digits[index]);
        if (!pick || pick < 1 || pick > q.options.length) return q;
        return { ...q, options: q.options.map((o, j) => ({ ...o, correct: j === pick - 1 })) };
      }),
    );
  }, [answerKey]);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const imported = await api.admin.importPaper({
        subjectId: subjectChoice === NEW ? undefined : Number(subjectChoice),
        newSubjectName: subjectChoice === NEW ? newSubjectName.trim() : undefined,
        examId: examChoice === NEW ? undefined : Number(examChoice),
        newExamTitle: examChoice === NEW ? newExamTitle.trim() : undefined,
        title: title.trim(),
        year: year ? Number(year) : undefined,
        replaceExisting: true,
        questions: drafts,
      });
      setResult(imported);
      // The figures are now referenced by live questions — keep them
      if (job) void api.admin.discardExtraction(job.jobId, true).catch(() => {});
      setJob(null);
      setDrafts([]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Publishing failed.");
    } finally {
      setBusy(false);
    }
  }

  const unanswered = drafts.filter((q) => !q.options.some((o) => o.correct)).length;
  const flagged = new Set(job?.needsReview ?? []);
  const fieldClass =
    "mt-2 w-full rounded-xl border border-rule bg-paper/60 px-4 py-3 text-ink outline-none transition focus:border-teal focus:bg-card focus:ring-4 focus:ring-teal-wash";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Import a PDF</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Pages are rendered as images and read by a vision model, so papers set in legacy
            Sinhala fonts come through correctly and diagrams are captured.
          </p>
        </div>
        <Link
          href="/admin/papers"
          className="rounded-full border border-rule px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
        >
          Upload JSON instead
        </Link>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-verdict-true-ink/25 bg-verdict-true p-5">
          <p className="font-serif text-lg font-semibold text-verdict-true-ink">Paper published</p>
          <p className="mt-1.5 text-sm text-verdict-true-ink/90">
            <strong>{result.paperTitle}</strong> filed under {result.subjectName} ›{" "}
            {result.examTitle} — {result.questionsImported} questions, {result.totalMarks} marks.
          </p>
          <Link
            href={`/exams/${result.examId}/papers/${result.paperId}`}
            className="mt-3 inline-block text-sm font-semibold text-verdict-true-ink underline underline-offset-4"
          >
            Open the paper
          </Link>
        </div>
      )}

      {/* Upload */}
      {!job && (
        <form onSubmit={upload} className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
          {vision === false && (
            <div className="mb-5 rounded-xl border border-amber/40 bg-amber-wash/70 px-4 py-3 text-sm text-ink-soft">
              <strong className="text-ink">Vision extraction is not configured.</strong> Set{" "}
              <code className="rounded bg-card px-1 py-0.5 font-mono text-[12px]">
                ANTHROPIC_API_KEY
              </code>{" "}
              on the API to read real papers. You can still run the flow with sample data.
            </div>
          )}

          <label
            htmlFor="pdf-file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-rule bg-paper/50 px-6 py-10 text-center transition hover:border-teal hover:bg-teal-wash/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
          >
            <span className="font-serif text-base font-semibold text-ink">
              {file ? file.name : "Choose a PDF, or drop one here"}
            </span>
            <span className="mt-1 text-xs text-ink-faint">
              {file ? `${(file.size / 1048576).toFixed(1)} MB` : "up to 40 MB"}
            </span>
          </label>
          <input
            ref={fileRef}
            id="pdf-file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <label className="mt-4 flex items-start gap-2.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={useSample}
              disabled={vision === false}
              onChange={(e) => setUseSample(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[color:var(--color-teal-deep)]"
            />
            <span>
              Use sample data instead of calling the model
              <span className="block text-xs text-ink-faint">
                Renders the real pages but fills the draft with two example questions, so you can
                try the review and publish flow without spending tokens.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={!file || busy}
            className="mt-5 rounded-full bg-teal-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink-faint"
          >
            {busy ? "Uploading…" : "Extract questions"}
          </button>
        </form>
      )}

      {/* Progress */}
      {job && job.status === "RUNNING" && (
        <div className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
          <p className="font-serif text-lg font-semibold text-ink">{job.message}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded bg-rule">
            <div
              className="h-full rounded bg-gradient-to-r from-teal to-amber transition-[width] duration-500"
              style={{
                width: `${job.pagesTotal ? (job.pagesDone / job.pagesTotal) * 100 : 8}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            {job.fileName} · {job.model}
          </p>
        </div>
      )}

      {job && job.status === "FAILED" && (
        <div className="rounded-2xl border border-verdict-false-ink/25 bg-verdict-false p-6">
          <p className="font-serif text-lg font-semibold text-verdict-false-ink">
            Extraction failed
          </p>
          <p className="mt-1.5 text-sm text-verdict-false-ink/90">{job.message}</p>
          <button
            type="button"
            onClick={() => setJob(null)}
            className="mt-4 rounded-lg border border-verdict-false-ink/40 px-4 py-2 text-sm font-semibold text-verdict-false-ink"
          >
            Try another file
          </button>
        </div>
      )}

      {/* Review */}
      {job && job.status === "DONE" && (
        <>
          <div className="rounded-2xl border border-rule bg-card p-5 shadow-paper">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-serif text-lg font-semibold text-ink">
                {drafts.length} questions extracted
              </p>
              <span className="text-xs text-ink-faint">
                {job.fileName} · {job.model} · {job.pagesTotal} pages
              </span>
            </div>

            {job.errors.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 rounded-lg bg-verdict-false px-5 py-3 text-xs text-verdict-false-ink">
                {job.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {job.warnings.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-amber">
                  {job.warnings.length} warning{job.warnings.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-soft">
                  {job.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-4 rounded-xl border border-rule bg-paper/60 p-4">
              <label className="text-sm font-semibold text-ink">Marking scheme</label>
              <p className="mt-1 text-xs text-ink-soft">
                Paste the answers in question order — digits only, spaces optional. The model is
                deliberately not asked to solve the paper.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={answerKey}
                  onChange={(e) => setAnswerKey(e.target.value)}
                  placeholder="5 1 5 1 3 3 …"
                  className="min-w-0 flex-1 rounded-lg border border-rule bg-card px-3 py-2 font-mono text-sm text-ink outline-none focus:border-teal"
                />
                <button
                  type="button"
                  onClick={applyKey}
                  className="rounded-lg bg-teal-deep px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal"
                >
                  Apply key
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                {unanswered === 0
                  ? "Every question has an answer."
                  : `${unanswered} of ${drafts.length} questions still have no answer.`}
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
            {/* Source pages */}
            <section className="rounded-2xl border border-rule bg-card p-4 shadow-paper">
              <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Original pages</h2>
              <div className="max-h-[70vh] space-y-3 overflow-y-auto">
                {job.pageImages.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={mediaUrl(src)!}
                    alt={`Page ${i + 1}`}
                    loading="lazy"
                    className="w-full rounded-lg border border-rule bg-white"
                  />
                ))}
              </div>
            </section>

            {/* Draft */}
            <section className="rounded-2xl border border-rule bg-paper/40 p-4">
              <h2 className="mb-3 font-serif text-lg font-semibold text-ink">
                Draft — check against the pages
              </h2>
              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {drafts.map((q, i) => (
                  <QuestionRow
                    key={q.number}
                    q={q}
                    flagged={flagged.has(q.number)}
                    onChange={(next) =>
                      setDrafts((current) => current.map((x, j) => (j === i ? next : x)))
                    }
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Where it goes */}
          <div className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal">
              Where it goes
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-ink">1 · Subject</span>
                <select
                  value={subjectChoice}
                  onChange={(e) => {
                    setSubjectPick(e.target.value);
                    setExamPick("");
                  }}
                  className={fieldClass}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                  <option value={NEW}>+ Create a new subject…</option>
                </select>
              </label>

              {subjectChoice === NEW && (
                <label className="block">
                  <span className="text-sm font-semibold text-ink">New subject name</span>
                  <input
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Physics"
                    className={fieldClass}
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-ink">2 · Exam</span>
                <select
                  value={examChoice}
                  onChange={(e) => setExamPick(e.target.value)}
                  className={fieldClass}
                >
                  {examsInSubject.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.title}
                    </option>
                  ))}
                  <option value={NEW}>+ Create a new exam…</option>
                </select>
              </label>

              {examChoice === NEW && (
                <label className="block">
                  <span className="text-sm font-semibold text-ink">New exam title</span>
                  <input
                    value={newExamTitle}
                    onChange={(e) => setNewExamTitle(e.target.value)}
                    placeholder="GCE A/L Physics"
                    className={fieldClass}
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-ink">3 · Paper title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="2024 Paper"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-ink">Year</span>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="2024"
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={publish}
                disabled={
                  busy ||
                  drafts.length === 0 ||
                  job.errors.length > 0 ||
                  !title.trim() ||
                  (subjectChoice === NEW && !newSubjectName.trim()) ||
                  (examChoice === NEW && !newExamTitle.trim())
                }
                className="rounded-full bg-teal-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink-faint"
              >
                {busy ? "Publishing…" : `Publish ${drafts.length} questions`}
              </button>
              <button
                type="button"
                onClick={() => {
                  void api.admin.discardExtraction(job.jobId).catch(() => {});
                  setJob(null);
                  setDrafts([]);
                }}
                className="rounded-full border border-rule px-5 py-3 text-sm font-semibold text-ink-soft transition hover:border-teal"
              >
                Discard
              </button>
            </div>
            {job.errors.length > 0 && (
              <p className="mt-2 text-xs text-verdict-false-ink">
                Clear the errors above before publishing.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
