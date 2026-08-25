"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { AnswerSubmission, Paper, Question } from "../lib/types";

/** What a question is worth: true/false papers award one mark per statement. */
function marksFor(question: Question): number {
  return question.type === "tf" ? Math.max(question.options.length, 1) : 1;
}

interface QuestionState {
  checked: boolean;
  /** tf: option id -> the user's True/False verdict */
  verdicts: Record<number, boolean>;
  /** single/multi: the option ids picked */
  picked: number[];
  earned: number;
}

function emptyState(): QuestionState {
  return { checked: false, verdicts: {}, picked: [], earned: 0 };
}

/** Which language(s) the reader wants to see. */
export type Lang = "en" | "si" | "both";

const LANG_KEY = "epe.lang";

function useLanguage(): [Lang, (next: Lang) => void] {
  const [lang, setLang] = useState<Lang>("both");

  // Read the stored preference once the component is on the client. The server
  // renders "both", so the read has to happen after mount to avoid a hydration
  // mismatch — hence the deferred callback rather than a lazy initialiser.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      const stored = window.localStorage.getItem(LANG_KEY);
      if (!cancelled && (stored === "en" || stored === "si" || stored === "both")) {
        setLang(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback((next: Lang) => {
    window.localStorage.setItem(LANG_KEY, next);
    setLang(next);
  }, []);

  return [lang, choose];
}

/** Renders a piece of text in the chosen language, falling back to whatever exists. */
function Bilingual({
  en,
  si,
  lang,
  className = "",
  siClassName = "sinhala-note mt-1.5 block",
}: {
  en: string | null | undefined;
  si: string | null | undefined;
  lang: Lang;
  className?: string;
  siClassName?: string;
}) {
  const hasEn = Boolean(en);
  const hasSi = Boolean(si);
  if (!hasEn && !hasSi) return null;

  // Asking for one language you do not have still shows you the other
  const showEn = lang === "en" ? hasEn : lang === "si" ? !hasSi : hasEn;
  const showSi = lang === "si" ? hasSi : lang === "en" ? !hasEn : hasSi;

  return (
    <span className={className}>
      {showEn && <span className="block">{en}</span>}
      {showSi && <span className={siClassName}>{si}</span>}
    </span>
  );
}

function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (next: Lang) => void }) {
  const choices: { value: Lang; label: string; title: string }[] = [
    { value: "en", label: "EN", title: "English only" },
    { value: "si", label: "සිං", title: "Sinhala only" },
    { value: "both", label: "Both", title: "English and Sinhala" },
  ];

  return (
    <div
      role="group"
      aria-label="Question language"
      className="flex flex-none overflow-hidden rounded-md border border-rule bg-card"
    >
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          title={choice.title}
          aria-pressed={lang === choice.value}
          onClick={() => onChange(choice.value)}
          className={`px-2.5 py-1 text-[11px] font-bold transition ${
            lang === choice.value
              ? "bg-teal-deep text-white"
              : "text-ink-faint hover:bg-paper"
          }`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function scoreQuestion(question: Question, state: QuestionState): number {
  if (question.type === "tf") {
    return question.options.reduce((total, option) => {
      const verdict = state.verdicts[option.id];
      return verdict !== undefined && verdict === Boolean(option.correct) ? total + 1 : total;
    }, 0);
  }

  const correctIds = question.options.filter((o) => o.correct).map((o) => o.id);
  const picked = state.picked;
  const same =
    picked.length > 0 &&
    picked.length === correctIds.length &&
    correctIds.every((id) => picked.includes(id));
  return same ? 1 : 0;
}

// --- small presentational pieces -----------------------------------------

function Explanation({ en, si, lang }: { en: string | null; si: string | null; lang: Lang }) {
  if (!en && !si) return null;
  return (
    <div className="mb-2 pl-10 pr-2 text-[13px] leading-relaxed text-ink-soft">
      <Bilingual en={en} si={si} lang={lang} siClassName="sinhala-note mt-1.5 block text-[13.5px]" />
    </div>
  );
}

const MEDIA_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8083";

/** Figures are served by the API, so relative paths need its origin prefixed. */
function Figure({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) return null;
  const url = src.startsWith("http") ? src : `${MEDIA_BASE}${src}`;
  return (
    // Remote host, and the size is unknown until it loads — a plain img avoids
    // having to declare every API origin to next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className ?? "mt-3 max-h-80 rounded-lg border border-rule bg-white object-contain"}
    />
  );
}

function VerdictTag({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mt-0.5 flex-none rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
        ok ? "bg-verdict-true-ink" : "bg-verdict-false-ink"
      }`}
    >
      {ok ? "✓" : "✗"}
    </span>
  );
}

// --- one question card ----------------------------------------------------

interface CardProps {
  question: Question;
  index: number;
  state: QuestionState;
  onVerdict: (optionId: number, verdict: boolean) => void;
  onPick: (optionId: number) => void;
  onCheck: () => void;
  lang: Lang;
}

function QuestionCard({ question, index, state, onVerdict, onPick, onCheck, lang }: CardProps) {
  const { checked } = state;
  const marks = marksFor(question);

  return (
    <article
      id={`question-${question.id}`}
      className="scroll-mt-28 rounded-xl border border-rule bg-card p-5 shadow-paper sm:p-6"
    >
      <span className="inline-block rounded-full bg-teal-deep px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
        Question {index + 1}
      </span>

      <h2 className="mt-3 font-serif text-[17.5px] leading-snug text-ink sm:text-lg">
        <Bilingual
          en={question.stem}
          si={question.stemSi}
          lang={lang}
          siClassName="sinhala-note mt-2 block text-[16.5px] leading-relaxed"
        />
      </h2>
      {(question.note || question.noteSi) && (
        <p className="mt-1.5 text-xs text-ink-faint">
          <Bilingual
            en={question.note}
            si={question.noteSi}
            lang={lang}
            siClassName="sinhala-note mt-1 block"
          />
        </p>
      )}

      <Figure src={question.imageUrl} alt={`Figure for question ${index + 1}`} />

      {/* True / false statements */}
      {question.type === "tf" && (
        <ul className="mt-4">
          {question.options.map((option) => {
            const verdict = state.verdicts[option.id];
            const right = checked && verdict !== undefined && verdict === Boolean(option.correct);
            const wrong = checked && !right;

            return (
              <li key={option.id}>
                <div
                  className={`flex items-start gap-3 rounded-lg border border-transparent px-2.5 py-2.5 ${
                    right ? "bg-verdict-true" : wrong ? "bg-verdict-false" : ""
                  }`}
                >
                  <span className="w-4 flex-none pt-0.5 text-[13px] font-bold text-teal-deep">
                    {option.label}.
                  </span>
                  <span className="flex-1 text-[15px] leading-snug text-ink">
                    <Bilingual
                      en={option.text}
                      si={option.textSi}
                      lang={lang}
                      siClassName="sinhala-note mt-1 block text-[15.5px]"
                    />
                  </span>

                  <div
                    role="group"
                    aria-label={`Statement ${option.label}`}
                    className="flex flex-none overflow-hidden rounded-md border-[1.5px] border-rule"
                  >
                    {[true, false].map((value) => {
                      const active = verdict === value;
                      return (
                        <button
                          key={String(value)}
                          type="button"
                          disabled={checked}
                          aria-pressed={active}
                          onClick={() => onVerdict(option.id, value)}
                          // Selection is teal rather than green/red on purpose: the colour
                          // marks "this is my answer", not "this answer is right".
                          className={`min-w-[46px] px-3 py-1.5 text-xs font-bold transition ${
                            active
                              ? "bg-teal-deep text-white"
                              : "bg-card text-ink-faint hover:bg-paper"
                          } ${value ? "border-r-[1.5px] border-rule" : ""} ${
                            checked ? "cursor-default" : "cursor-pointer"
                          }`}
                        >
                          {value ? "True" : "False"}
                        </button>
                      );
                    })}
                  </div>

                  {checked && <VerdictTag ok={right} />}
                </div>

                {checked && (
                  <div className="pt-1">
                    <div className="mb-2 pl-10 pr-2 text-[13px] leading-relaxed text-ink-soft">
                      <p>
                        <span className="font-semibold text-ink">
                          {option.label}. {option.correct ? "True." : "False."}
                        </span>{" "}
                        <Bilingual
                          en={option.explanationEn}
                          si={option.explanationSi}
                          lang={lang}
                          siClassName="sinhala-note mt-1.5 block text-[13.5px]"
                        />
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Single best answer */}
      {question.type !== "tf" && (
        <>
          <ul role="radiogroup" aria-label={question.stem} className="mt-4">
            {question.options.map((option) => {
              const picked = state.picked.includes(option.id);
              const showCorrect = checked && option.correct;
              const showWrong = checked && picked && !option.correct;

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    disabled={checked}
                    onClick={() => onPick(option.id)}
                    className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition ${
                      showCorrect
                        ? "bg-verdict-true"
                        : showWrong
                          ? "bg-verdict-false"
                          : checked
                            ? ""
                            : "hover:bg-paper"
                    } ${checked ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex-none rounded-full border-2 ${
                        picked ? "border-teal bg-teal" : "border-rule"
                      } h-[18px] w-[18px] ring-2 ring-inset ring-card`}
                    />
                    <span className="w-4 flex-none pt-0.5 text-[13px] font-bold text-teal-deep">
                      {option.label}.
                    </span>
                    <span className="flex-1 text-[15px] leading-snug text-ink">
                      <Bilingual
                        en={option.text}
                        si={option.textSi}
                        lang={lang}
                        siClassName="sinhala-note mt-1 block text-[15.5px]"
                      />
                      <Figure
                        src={option.imageUrl}
                        alt={`Option ${option.label}`}
                        className="mt-1.5 max-h-48 rounded border border-rule bg-white object-contain"
                      />
                    </span>

                    {checked && (showCorrect || showWrong) && (
                      <span
                        className={`mt-0.5 flex-none rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
                          showCorrect ? "bg-verdict-true-ink" : "bg-verdict-false-ink"
                        }`}
                      >
                        {showCorrect ? "Correct answer" : "Your answer"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {checked && (
            <div className="mt-3">
              <Explanation en={question.explanation} si={question.explanationSi} lang={lang} />
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
        <button
          type="button"
          onClick={onCheck}
          disabled={checked}
          className="rounded-lg bg-teal-deep px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-teal disabled:cursor-default disabled:bg-ink-faint"
        >
          {checked ? "Checked" : "Check answers"}
        </button>

        {checked && (
          <p className="text-[13px] text-ink-soft">
            You got{" "}
            <b className="text-teal-deep">
              {state.earned} / {marks}
            </b>{" "}
            {marks === 1
              ? state.earned === 1
                ? "— correct"
                : "— not quite"
              : "correct on this question"}
          </p>
        )}
      </div>
    </article>
  );
}

// --- the runner -----------------------------------------------------------

interface Props {
  paper: Paper;
  questions: Question[];
}

export default function QuizRunner({ paper, questions }: Props) {
  const [lang, setLang] = useLanguage();
  const [states, setStates] = useState<Record<number, QuestionState>>({});
  /** Holds the in-flight or resolved "open an attempt" call, so it only ever runs once. */
  const attemptRef = useRef<Promise<number | null> | null>(null);
  const submittedRef = useRef(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const totalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + marksFor(q), 0),
    [questions],
  );

  const checkedQuestions = useMemo(
    () => questions.filter((q) => states[q.id]?.checked),
    [questions, states],
  );

  const earnedMarks = checkedQuestions.reduce((sum, q) => sum + (states[q.id]?.earned ?? 0), 0);
  const attemptedMarks = checkedQuestions.reduce((sum, q) => sum + marksFor(q), 0);
  const allChecked = checkedQuestions.length === questions.length && questions.length > 0;

  const stateFor = useCallback(
    (id: number) => states[id] ?? emptyState(),
    [states],
  );

  /**
   * Opens the graded attempt on the server the first time the user checks a question.
   * Practising while the server is unreachable still works — only the saved record is lost.
   */
  const ensureAttempt = useCallback((): Promise<number | null> => {
    attemptRef.current ??= api
      .startQuiz(paper.id)
      .then((started) => started.attemptId)
      .catch(() => null);
    return attemptRef.current;
  }, [paper.id]);

  const setVerdict = useCallback((questionId: number, optionId: number, verdict: boolean) => {
    setStates((prev) => {
      const current = prev[questionId] ?? emptyState();
      if (current.checked) return prev;
      return {
        ...prev,
        [questionId]: { ...current, verdicts: { ...current.verdicts, [optionId]: verdict } },
      };
    });
  }, []);

  const setPick = useCallback((questionId: number, optionId: number) => {
    setStates((prev) => {
      const current = prev[questionId] ?? emptyState();
      if (current.checked) return prev;
      return { ...prev, [questionId]: { ...current, picked: [optionId] } };
    });
  }, []);

  const check = useCallback(
    (question: Question) => {
      void ensureAttempt();

      setStates((prev) => {
        const current = prev[question.id] ?? emptyState();
        if (current.checked) return prev;
        return {
          ...prev,
          [question.id]: { ...current, checked: true, earned: scoreQuestion(question, current) },
        };
      });
    },
    [ensureAttempt],
  );

  // Record the finished attempt once every question has been checked.
  useEffect(() => {
    if (!allChecked || submittedRef.current) return;
    submittedRef.current = true;

    let cancelled = false;

    (async () => {
      const attemptId = await ensureAttempt();
      if (cancelled) return;

      if (attemptId === null) {
        setSaveNote("This run was not saved — the server could not be reached.");
        return;
      }

      const answers: AnswerSubmission[] = questions.map((question) => {
        const state = states[question.id] ?? emptyState();
        return question.type === "tf"
          ? { questionId: question.id, optionAnswers: state.verdicts }
          : { questionId: question.id, selectedOptionIds: state.picked };
      });

      try {
        await api.submitQuiz(attemptId, answers);
        if (!cancelled) setSaveNote("Saved to your attempt history.");
      } catch {
        if (!cancelled) setSaveNote("We could not save this attempt to your history.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // `states` is deliberately read at the moment the paper completes, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChecked, ensureAttempt, questions]);

  const progressPct = questions.length
    ? (checkedQuestions.length / questions.length) * 100
    : 0;

  return (
    <>
      {/* Progress */}
      <div className="sticky top-16 z-30 -mx-5 border-b border-rule bg-paper/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div
            className="h-1.5 overflow-hidden rounded bg-rule"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={checkedQuestions.length}
            aria-label="Questions checked"
          >
            <div
              className="h-full rounded bg-gradient-to-r from-teal to-amber transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-ink-soft">
            <span className="truncate">
              {checkedQuestions.length} of {questions.length} questions checked
            </span>
            <span className="flex flex-none items-center gap-3">
              <LanguageToggle lang={lang} onChange={setLang} />
              <span className="font-bold text-teal-deep">
                Score: {earnedMarks} / {attemptedMarks}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        {/* Final result */}
        {allChecked && (
          <div className="mt-6 rounded-xl bg-teal-deep px-6 py-7 text-center">
            <p className="font-serif text-4xl font-bold text-white">
              {earnedMarks} / {totalMarks}
            </p>
            <p className="mt-1 text-[13px] text-white/75">
              correct across the whole paper — scroll up to review any explanation again
            </p>
            <p className="mt-1 text-[13px] text-white/60">
              {Math.round((earnedMarks / Math.max(totalMarks, 1)) * 100)}% ·{" "}
              {questions.filter((q) => states[q.id]?.earned === marksFor(q)).length} of{" "}
              {questions.length} questions fully correct
            </p>
            {saveNote && <p className="mt-3 text-xs text-white/50">{saveNote}</p>}
          </div>
        )}

        <div className="mt-6 space-y-5 pb-16">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              state={stateFor(question.id)}
              onVerdict={(optionId, verdict) => setVerdict(question.id, optionId, verdict)}
              onPick={(optionId) => setPick(question.id, optionId)}
              onCheck={() => check(question)}
              lang={lang}
            />
          ))}
        </div>
      </div>
    </>
  );
}
