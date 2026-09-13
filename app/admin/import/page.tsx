"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../lib/api";
import type {
  DraftQuestion,
  Exam,
  ExtractedAnswer,
  ExtractionJob,
  ImportPaperResult,
  Subject,
} from "../../lib/types";
import { QuestionRow, mediaUrl } from "../../components/QuestionEditor";

const NEW = "__new__";

/* -------------------------------------------------------------------- page */

export default function AdminPdfImportPage() {
  const [vision, setVision] = useState<boolean | null>(null);
  const [quota, setQuota] = useState<{
    exhausted: boolean;
    resetsAt: string | null;
    used: number;
    limit: number | null;
  } | null>(null);
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
  const keyFileRef = useRef<HTMLInputElement>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyNote, setKeyNote] = useState<string | null>(null);
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
        setQuota({ exhausted: caps.quotaExhausted, resetsAt: caps.quotaResetsAt, used: caps.requestsToday, limit: caps.dailyLimit });
        // Nothing to extract with, so start in the mode that still works.
        setUseSample(!caps.vision || caps.quotaExhausted);
        setSubjects(s);
        setExams(e);
      })
      .catch(() => {
        if (!controller.signal.aborted) setVision(false);
      });
    return () => controller.abort();
  }, []);

  /** Re-asks the server about the quota, so the banner appears without a reload. */
  const refreshQuota = useCallback(async () => {
    try {
      const caps = await api.admin.importCapabilities();
      setQuota({ exhausted: caps.quotaExhausted, resetsAt: caps.quotaResetsAt, used: caps.requestsToday, limit: caps.dailyLimit });
      if (caps.quotaExhausted) setUseSample(true);
    } catch {
      // The banner is a courtesy; the job's own error already said what happened.
    }
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
          // A run that died on quota should raise the banner straight away.
          if (next.status === "FAILED") void refreshQuota();
        })
        .catch(() => {});
    }, 2500);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [job, refreshQuota]);

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
      setError(cause instanceof ApiError ? cause.message : "That file could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Attaches an extracted marking scheme to the draft: marks the correct option
   * and copies the reasoning onto the matching question.
   *
   * Matched on the question number the scheme prints, not on position, because a
   * scheme often covers a different range than the pages that were extracted.
   */
  const applyAnswerKey = useCallback((entries: ExtractedAnswer[]) => {
    const byNumber = new Map(entries.map((a) => [a.number, a]));
    let matched = 0;
    let withReasoning = 0;
    const unmatchedLabels: string[] = [];

    setDrafts((current) =>
      current.map((q) => {
        const key = byNumber.get(q.number);
        if (!key) return q;
        matched++;

        // Labels are printed inconsistently — "3", "(3)", "C", "c" all occur.
        const wanted = key.answers.map((a) => a.replace(/[()\s.]/g, "").toLowerCase());
        const options = q.options.map((o) => ({
          ...o,
          correct: wanted.includes(o.L.replace(/[()\s.]/g, "").toLowerCase()),
        }));

        if (wanted.length > 0 && !options.some((o) => o.correct)) {
          unmatchedLabels.push(`Q${q.number}: "${key.answers.join(", ")}"`);
        }
        if (key.exp || key.exp_si) withReasoning++;

        return {
          ...q,
          options,
          // Only fill a blank — never overwrite reasoning already typed by hand.
          exp: q.exp ?? key.exp,
          exp_si: q.exp_si ?? key.exp_si,
        };
      }),
    );

    const bits = [`${matched} of ${entries.length} answers matched a question`];
    if (withReasoning) bits.push(`${withReasoning} brought an explanation`);
    if (unmatchedLabels.length) {
      bits.push(
        `no option matched the printed answer for ${unmatchedLabels.length}: ${unmatchedLabels
          .slice(0, 5)
          .join(", ")}`,
      );
    }
    setKeyNote(bits.join(" · "));
  }, []);

  async function uploadAnswerKey(file: File | undefined) {
    if (!file) return;
    setKeyBusy(true);
    setKeyNote(null);
    setError(null);
    try {
      const { jobId } = await api.admin.extractAnswers(file);

      // Same polling shape as the paper extraction, but this job is short.
      for (let tick = 0; tick < 150; tick++) {
        await new Promise((r) => setTimeout(r, 2500));
        const job = await api.admin.extractionStatus(jobId);
        setKeyNote(job.message);
        if (job.status === "DONE") {
          applyAnswerKey(job.answers ?? []);
          return;
        }
        if (job.status === "FAILED") {
          setError(job.errors.join(" ") || job.message || "The marking scheme could not be read.");
          setKeyNote(null);
          void refreshQuota();
          return;
        }
      }
      setKeyNote("Still working — reload and check again shortly.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That marking scheme could not be read.");
      setKeyNote(null);
    } finally {
      setKeyBusy(false);
      if (keyFileRef.current) keyFileRef.current.value = "";
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

      {/*
        Said here rather than after the upload: rasterising a long PDF takes a
        while, and finding out at the end that not one page could be read is a
        waste of everybody's time.
      */}
      {quota && vision && (
        <div
          role={quota.exhausted ? "alert" : undefined}
          className={`rounded-2xl border p-5 ${
            quota.exhausted
              ? "border-amber/40 bg-amber-wash/60"
              : "border-rule bg-card shadow-paper"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-serif text-lg font-semibold text-ink">
              {quota.exhausted
                ? "The vision model’s daily quota is used up"
                : "Vision quota"}
            </p>
            <p className="text-sm font-semibold text-ink-soft">
              {quota.used} request{quota.used === 1 ? "" : "s"} from this server today
              {quota.limit ? ` · cap ${quota.limit}` : ""}
            </p>
          </div>

          {/*
            The count is deliberately described as "from this server". It cannot be
            the whole picture: the same key is used from the developer's machine,
            and the tally restarts whenever the free instance wakes from sleep. A
            number presented as authoritative would be wrong more often than right.
          */}
          <p className="mt-1.5 text-sm text-ink-soft">
            Each page of a PDF costs one request, and the allowance is shared by every machine
            using this API key — the free tier gives 20 a day. Runs from your own computer count
            against it too but are not included above.
            {quota.resetsAt && (
              <>
                {" "}
                It resets{" "}
                <strong>
                  {new Date(quota.resetsAt).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </strong>{" "}
                (midnight Pacific).
              </>
            )}
          </p>

          {quota.exhausted && (
            <p className="mt-2 text-sm text-ink-soft">
              Reading a marking scheme is unavailable until then too. You can still tick{" "}
              <em>use sample data</em> below to try the review and publish flow, edit papers you
              have already imported, or add billing to the key to lift the cap.
            </p>
          )}
        </div>
      )}

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
            accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-faint">
              {job.fileName} · {job.model}
              {job.pagesTotal > 0 && ` · page ${job.pagesDone} of ${job.pagesTotal}`}
            </p>
            {/*
              Each page costs one call from a small daily allowance, so being able
              to stop a run you started by mistake is worth more than it looks.
            */}
            <button
              type="button"
              onClick={() => void api.admin.cancelExtraction(job.jobId).catch(() => {})}
              className="rounded-full border border-verdict-false-ink/30 px-4 py-1.5 text-xs font-semibold text-verdict-false-ink transition hover:bg-verdict-false"
            >
              Stop
            </button>
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">
            Stopping finishes the page being read and keeps whatever came back.
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

              {/*
                The paste box only carries answers. A real marking scheme also
                prints the reasoning, which is the part students actually come
                for, so it can be uploaded and attached question by question.
              */}
              <div className="mt-4 border-t border-rule pt-4">
                <label className="text-sm font-semibold text-ink">
                  …or upload the answer sheet
                </label>
                <p className="mt-1 text-xs text-ink-soft">
                  Reads the correct answer <em>and</em> the printed explanation for each question,
                  and attaches them by question number. Existing explanations are left alone.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={keyBusy || vision === false || !!quota?.exhausted}
                    onClick={() => keyFileRef.current?.click()}
                    className="rounded-lg border border-teal/40 bg-teal-wash px-4 py-2 text-sm font-semibold text-teal-deep transition hover:border-teal hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {keyBusy ? "Reading…" : "Upload marking scheme (PDF or image)"}
                  </button>
                  {(vision === false || quota?.exhausted) && (
                    <span className="text-xs text-ink-faint">
                      {quota?.exhausted
                        ? "Daily quota used up — paste the answers above instead."
                        : "Needs a vision API key — paste the answers above instead."}
                    </span>
                  )}
                </div>
                <input
                  ref={keyFileRef}
                  type="file"
                  accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void uploadAnswerKey(e.target.files?.[0])}
                />
                {keyNote && <p className="mt-2 text-xs text-teal-deep">{keyNote}</p>}
              </div>
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
                    position={i + 1}
                    isFirst={i === 0}
                    isLast={i === drafts.length - 1}
                    flagged={flagged.has(q.number)}
                    onChange={(next) =>
                      setDrafts((current) => current.map((x, j) => (j === i ? next : x)))
                    }
                    onRemove={() =>
                      setDrafts((current) => current.filter((_, j) => j !== i))
                    }
                    onMove={(delta) =>
                      setDrafts((current) => {
                        const to = i + delta;
                        if (to < 0 || to >= current.length) return current;
                        const next = [...current];
                        [next[i], next[to]] = [next[to], next[i]];
                        return next;
                      })
                    }
                  />
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setDrafts((current) => [
                      ...current,
                      {
                        // Keep numbers unique: they identify a question for the
                        // extractor's review flags, and are not the display order.
                        number: Math.max(0, ...current.map((q) => q.number)) + 1,
                        stem: "",
                        stem_si: null,
                        type: "single",
                        options: ["1", "2", "3", "4", "5"].map((L) => ({
                          L,
                          text: "",
                          text_si: null,
                          correct: false,
                        })),
                      },
                    ])
                  }
                  className="w-full rounded-xl border border-dashed border-rule py-3 text-sm font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
                >
                  + Add a question
                </button>
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
