"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ApiError, api } from "../../../../lib/api";
import type { DraftQuestion, PaperReview, Question } from "../../../../lib/types";
import { QuestionRow } from "../../../../components/QuestionEditor";

/**
 * The editor speaks the draft shape used by the import review step, so the same
 * component serves both. These two functions are the only translation needed.
 */
function toDraft(q: Question, index: number): DraftQuestion {
  return {
    number: index + 1,
    stem: q.stem,
    stem_si: q.stemSi ?? null,
    type: q.type,
    note: q.note ?? null,
    note_si: q.noteSi ?? null,
    exp: q.explanation ?? null,
    exp_si: q.explanationSi ?? null,
    image: q.imageUrl ?? null,
    options: q.options.map((o) => ({
      id: o.id,
      L: o.label,
      text: o.text,
      text_si: o.textSi ?? null,
      image: o.imageUrl ?? null,
      // The API models this as nullable; the editor treats absent as not correct.
      correct: o.correct ?? false,
      exp: o.explanationEn ?? null,
      exp_si: o.explanationSi ?? null,
    })),
  };
}

function toRequest(d: DraftQuestion, paperId: number) {
  return {
    type: d.type,
    stem: d.stem,
    stemSi: d.stem_si,
    note: d.note ?? null,
    noteSi: d.note_si ?? null,
    explanation: d.exp ?? null,
    explanationSi: d.exp_si ?? null,
    imageUrl: d.image ?? null,
    paperId,
    options: d.options.map((o) => ({
      // Carrying the id back is what lets the server edit the row in place
      // instead of deleting it, which would take recorded answers with it.
      id: o.id,
      label: o.L,
      text: o.text,
      textSi: o.text_si,
      imageUrl: o.image ?? null,
      correct: o.correct,
      explanationEn: o.exp ?? null,
      explanationSi: o.exp_si ?? null,
    })),
  };
}

export default function EditPaperQuestionsPage() {
  const params = useParams<{ paperId: string }>();
  const search = useSearchParams();
  const paperId = Number(params.paperId);
  const examId = search.get("examId");

  const [original, setOriginal] = useState<Question[] | null>(null);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [review, setReview] = useState<PaperReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .questionsByPaper(paperId, controller.signal)
      .then((qs) => {
        if (controller.signal.aborted) return;
        setOriginal(qs);
        setDrafts(qs.map(toDraft));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load this paper.");
      });
    // A missing summary is not worth blocking the editor over.
    api.admin
      .paperReview(paperId, controller.signal)
      .then((r) => !controller.signal.aborted && setReview(r))
      .catch(() => {});
    return () => controller.abort();
  }, [paperId]);

  async function save() {
    if (!original) return;
    setBusy(true);
    setError(null);
    setSaved(null);

    try {
      // Only send what actually changed — 50 untouched questions do not need
      // 50 round trips, and every write is a chance to break something.
      const dirty = drafts
        .map((d, i) => ({ d, q: original[i] }))
        .filter(({ d, q }) => q && JSON.stringify(toRequest(d, paperId)) !== JSON.stringify(toRequest(toDraft(q, 0), paperId)));

      for (const { d, q } of dirty) {
        await api.admin.updateQuestion(q.id, toRequest(d, paperId));
      }

      const fresh = await api.questionsByPaper(paperId);
      setOriginal(fresh);
      setDrafts(fresh.map(toDraft));
      // Re-ask the server what still needs attention now the edits have landed.
      await api.admin.paperReview(paperId).then(setReview).catch(() => {});
      setSaved(
        dirty.length === 0
          ? "Nothing had changed."
          : `Saved ${dirty.length} question${dirty.length === 1 ? "" : "s"}.`,
      );
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  }

  const changed =
    original !== null &&
    drafts.length === original.length &&
    drafts.some(
      (d, i) =>
        JSON.stringify(toRequest(d, paperId)) !==
        JSON.stringify(toRequest(toDraft(original[i], 0), paperId)),
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Edit questions</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {original ? `${original.length} questions in this paper.` : "Loading…"} Changes are
            saved question by question, so answers students have already recorded stay intact.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/catalogue"
            className="rounded-full border border-rule px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
          >
            Back to catalogue
          </Link>
          {examId && (
            <Link
              href={`/exams/${examId}/papers/${paperId}`}
              className="rounded-full border border-rule px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
            >
              View paper
            </Link>
          )}
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink"
        >
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-xl border border-verdict-true-ink/25 bg-verdict-true px-4 py-3 text-sm text-verdict-true-ink">
          {saved}
        </div>
      )}

      {review && review.needsAttention > 0 && (
        <div className="rounded-2xl border border-amber/40 bg-amber-wash/50 p-5">
          <p className="font-serif text-lg font-semibold text-ink">
            {review.needsAttention} of {review.questionCount} questions need attention
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Jump to a question by its number. This list is from the server, so it reflects what is
            published rather than what is on screen — save and reload to refresh it.
          </p>
          <ul className="mt-3 space-y-1.5">
            {review.questions.map((f) => (
              <li key={f.questionId} className="flex flex-wrap items-baseline gap-2 text-sm">
                <a
                  href={`#q${f.number}`}
                  className="rounded bg-teal-deep px-1.5 py-0.5 text-[11px] font-bold text-white"
                >
                  Q{f.number}
                </a>
                <span className="font-semibold text-verdict-false-ink">
                  {f.reasons.join(" · ")}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">{f.preview}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review && review.needsAttention === 0 && (
        <div className="rounded-2xl border border-verdict-true-ink/25 bg-verdict-true px-5 py-3 text-sm text-verdict-true-ink">
          All {review.questionCount} questions look complete — every one has an answer marked and
          text in both languages.
        </div>
      )}

      {original && (
        <>
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rule bg-card/95 px-5 py-3 shadow-paper backdrop-blur">
            <p className="text-sm text-ink-soft">
              {changed ? "You have unsaved changes." : "No unsaved changes."}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={busy || !changed}
              className="rounded-full bg-teal-deep px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink-faint"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>

          <div className="space-y-3">
            {drafts.map((q, i) => (
              <div key={original[i]?.id ?? `new-${i}`} id={`q${i + 1}`} className="scroll-mt-24">
              <QuestionRow
                q={q}
                position={i + 1}
                isFirst
                isLast
                flagged={false}
                onChange={(next) =>
                  setDrafts((current) => current.map((x, j) => (j === i ? next : x)))
                }
                // Deleting and reordering published questions is deliberately not
                // offered here: order comes from the stored rows, and removing a
                // question would orphan the answers recorded against it.
                onRemove={() => {}}
                onMove={() => {}}
                readOnlyStructure
              />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
