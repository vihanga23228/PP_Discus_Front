"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../lib/api";
import { PaperParseError, parsePaperFile, type ParsedPaper } from "../../lib/paperFile";
import type { Exam, ImportPaperResult, Subject } from "../../lib/types";

const NEW = "__new__";

export default function AdminUploadPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  // file
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPaper | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // where it lands
  const [subjectPick, setSubjectPick] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [examPick, setExamPick] = useState("");
  const [newExamTitle, setNewExamTitle] = useState("");

  // paper details
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [acceptMissing, setAcceptMissing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportPaperResult | null>(null);

  const fetchCatalogue = useCallback(async (signal?: AbortSignal) => {
    const [subjectList, examList] = await Promise.all([
      api.subjects(signal),
      api.exams(signal),
    ]);
    return { subjectList, examList };
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) =>
      fetchCatalogue(signal)
        .then(({ subjectList, examList }) => {
          if (signal?.aborted) return;
          setSubjects(subjectList);
          setExams(examList);
          setListError(null);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setListError(cause instanceof Error ? cause.message : "Could not load the catalogue.");
        }),
    [fetchCatalogue],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Effective picks, derived rather than stored, so the lists can arrive late
  const subjectChoice =
    subjectPick || (subjects && subjects.length > 0 ? String(subjects[0].id) : NEW);
  const subjectId = subjectChoice === NEW ? null : Number(subjectChoice);

  // Only offer exams that sit under the chosen subject
  const examsInSubject = subjectId === null ? [] : exams.filter((e) => e.subjectId === subjectId);
  const examChoice =
    examPick || (examsInSubject.length > 0 ? String(examsInSubject[0].id) : NEW);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setParseError(null);
    setParsed(null);
    setResult(null);
    setSubmitError(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const paper = parsePaperFile(file.name, text);
      setParsed(paper);

      const yearMatch = file.name.match(/(19|20)\d{2}/);
      if (yearMatch && !year) {
        setYear(yearMatch[0]);
        if (!title) setTitle(`${yearMatch[0]} Paper`);
      }
    } catch (cause) {
      setParseError(
        cause instanceof PaperParseError
          ? cause.message
          : "That file could not be read. Upload a JSON question file or a quiz HTML page.",
      );
    }
  }

  function reset() {
    setFileName(null);
    setParsed(null);
    setParseError(null);
    setTitle("");
    setYear("");
    setDescription("");
    setReplaceExisting(false);
    setAcceptMissing(false);
    setSubmitError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed) return;

    setSubmitting(true);
    setSubmitError(null);
    setResult(null);

    try {
      const imported = await api.admin.importPaper({
        subjectId: subjectChoice === NEW ? undefined : Number(subjectChoice),
        newSubjectName: subjectChoice === NEW ? newSubjectName.trim() : undefined,
        examId: examChoice === NEW ? undefined : Number(examChoice),
        newExamTitle: examChoice === NEW ? newExamTitle.trim() : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        year: year ? Number(year) : undefined,
        replaceExisting,
        questions: parsed.questions,
      });
      setResult(imported);
      reset();
      await load();
    } catch (cause) {
      setSubmitError(
        cause instanceof ApiError ? cause.message : "That paper could not be uploaded.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    parsed !== null &&
    (parsed.missingAnswers.length === 0 || acceptMissing) &&
    title.trim().length > 0 &&
    (subjectChoice !== NEW || newSubjectName.trim().length > 0) &&
    (examChoice !== NEW || newExamTitle.trim().length > 0) &&
    !submitting;

  const fieldClass =
    "mt-2 w-full rounded-xl border border-rule bg-paper/60 px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-teal focus:bg-card focus:ring-4 focus:ring-teal-wash";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Upload a paper</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Drop in a question file and file it under a subject, exam and year.
          </p>
        </div>
        <Link
          href="/admin/catalogue"
          className="rounded-full border border-rule px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
        >
          Manage the catalogue
        </Link>
      </header>

      {listError && (
        <div className="rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink">
          {listError}
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-verdict-true-ink/25 bg-verdict-true p-5">
          <p className="font-serif text-lg font-semibold text-verdict-true-ink">
            {result.replacedExisting ? "Paper replaced" : "Paper uploaded"}
          </p>
          <p className="mt-1.5 text-sm text-verdict-true-ink/90">
            <strong>{result.paperTitle}</strong> filed under{" "}
            {result.subjectName && (
              <>
                <strong>{result.subjectName}</strong> ›{" "}
              </>
            )}
            <strong>{result.examTitle}</strong> — {result.questionsImported} questions (
            {result.optionsImported} options, {result.totalMarks} marks).
          </p>
          {result.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-verdict-true-ink/80">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <Link
            href={`/exams/${result.examId}/papers/${result.paperId}`}
            className="mt-3 inline-block text-sm font-semibold text-verdict-true-ink underline underline-offset-4"
          >
            Open the paper
          </Link>
        </div>
      )}

      <section className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
        <p className="text-sm text-ink-soft">
          Accepts a JSON question file, or a standalone quiz HTML page containing a{" "}
          <code className="rounded bg-paper px-1 py-0.5 font-mono text-[12px]">
            const QUESTIONS = [...]
          </code>{" "}
          array.
        </p>

        <div className="mt-5">
          <label
            htmlFor="paper-file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-rule bg-paper/50 px-6 py-8 text-center transition hover:border-teal hover:bg-teal-wash/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <span className="font-serif text-base font-semibold text-ink">
              {fileName ?? "Choose a file, or drop one here"}
            </span>
            <span className="mt-1 text-xs text-ink-faint">.json or .html</span>
          </label>
          <input
            ref={fileInputRef}
            id="paper-file"
            type="file"
            accept=".json,.html,.htm,application/json,text/html"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>

        {parseError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink"
          >
            {parseError}
          </div>
        )}

        {parsed && (
          <>
            <div className="mt-5 rounded-xl border border-rule bg-paper/60 p-4">
              <p className="text-sm font-semibold text-ink">
                Read {parsed.questions.length} questions · {parsed.totalMarks} marks
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {Object.entries(parsed.counts)
                  .map(([type, n]) => `${n} ${type === "tf" ? "true/false" : type}`)
                  .join(" · ")}{" "}
                · parsed from {parsed.source === "html" ? "the HTML page" : "JSON"} ·{" "}
                {parsed.dialect === "compact" ? "compact" : "full"} format
              </p>
              {parsed.warnings.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-amber">
                    {parsed.warnings.length} warning{parsed.warnings.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-soft">
                    {parsed.warnings.slice(0, 12).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                    {parsed.warnings.length > 12 && (
                      <li>…and {parsed.warnings.length - 12} more</li>
                    )}
                  </ul>
                </details>
              )}
            </div>

            {parsed.missingAnswers.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber/40 bg-amber-wash/70 p-4">
                <p className="text-sm font-semibold text-ink">
                  {parsed.missingAnswers.length} question
                  {parsed.missingAnswers.length === 1 ? "" : "s"} have no correct answer
                </p>
                <p className="mt-1.5 text-xs leading-5 text-ink-soft">
                  Students will never be able to score {
                    parsed.missingAnswers.length === parsed.questions.length ? "any" : "those"
                  } questions. Add an{" "}
                  <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">
                    &quot;answer&quot;
                  </code>{" "}
                  field to each one — the option number, like{" "}
                  <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">
                    &quot;answer&quot;: 3
                  </code>
                  .
                </p>
                <label className="mt-3 flex items-start gap-2.5 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={acceptMissing}
                    onChange={(e) => setAcceptMissing(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-[color:var(--color-amber)]"
                  />
                  <span>Publish anyway — I will add the answers later.</span>
                </label>
              </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal">
                Where it goes
              </p>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Subject */}
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
                    {(subjects ?? []).map((s) => (
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
                      placeholder="Pharmacy"
                      required
                      className={fieldClass}
                    />
                  </label>
                )}

                {/* Exam */}
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
                  {subjectChoice !== NEW && examsInSubject.length === 0 && (
                    <span className="mt-1.5 block text-xs text-ink-faint">
                      This subject has no exams yet — name a new one.
                    </span>
                  )}
                </label>

                {examChoice === NEW && (
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">New exam title</span>
                    <input
                      value={newExamTitle}
                      onChange={(e) => setNewExamTitle(e.target.value)}
                      placeholder="External Pharmacy Exam"
                      required
                      className={fieldClass}
                    />
                  </label>
                )}

                {/* Paper */}
                <label className="block">
                  <span className="text-sm font-semibold text-ink">3 · Paper title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="2021 Paper"
                    required
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-ink">Year</span>
                  <input
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    placeholder="2021"
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-ink">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="December 2021 MCQ paper — 50 questions with English and Sinhala explanations."
                  className={fieldClass}
                />
              </label>

              <label className="flex items-start gap-3 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--color-teal-deep)]"
                />
                <span>
                  Replace a paper that already has this title
                  <span className="block text-xs text-ink-faint">
                    Deletes the old questions and any attempts recorded against them.
                  </span>
                </span>
              </label>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink"
                >
                  {submitError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-full bg-teal-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink-faint"
                >
                  {submitting ? "Uploading…" : `Publish ${parsed.questions.length} questions`}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-rule px-5 py-3 text-sm font-semibold text-ink-soft transition hover:border-teal"
                >
                  Clear
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
