"use client";

import { useRef, useState } from "react";
import { ApiError, api } from "../lib/api";
import type { DraftQuestion } from "../lib/types";

const MEDIA_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8083").replace(/\/+$/, "");

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${MEDIA_BASE}${path}`;
}


const inputClass =
  "w-full rounded border border-rule bg-paper/60 px-2 py-1 text-[13px] text-ink outline-none focus:border-teal focus:bg-card";
const areaClass =
  "w-full rounded-lg border border-rule bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:bg-card";

/** Blank inputs should clear the field rather than store an empty string. */
const orNull = (v: string) => (v.trim() ? v : null);

/**
 * Attaches a diagram to a question. Diagrams are no longer cropped out of the
 * PDF automatically — an auto-crop guessed the bounds and often clipped an axis
 * label, so the screenshot is taken by hand instead.
 */
function FigureUpload({
  image,
  onChange,
}: {
  image: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.admin.uploadImage(file);
      onChange(url);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-rule bg-paper/40 p-2">
      {image ? (
        <div className="flex items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(image)!}
            alt="Question figure"
            className="max-h-40 flex-1 rounded border border-rule bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Remove this figure"
            className="flex-none rounded px-1.5 text-ink-faint hover:bg-verdict-false hover:text-verdict-false-ink"
          >
            ✕
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-ink-faint">No figure attached.</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-rule bg-card px-3 py-1 text-[12px] font-semibold text-teal-deep transition hover:border-teal hover:bg-teal-wash disabled:opacity-50"
        >
          {busy ? "Uploading…" : image ? "Replace screenshot" : "Upload screenshot"}
        </button>
        <span className="text-[11px] text-ink-faint">PNG, JPEG or WebP, up to 5 MB</span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => void upload(e.target.files?.[0])}
        className="hidden"
      />

      {error && <p className="mt-1 text-[11px] text-verdict-false-ink">{error}</p>}
    </div>
  );
}

export function QuestionRow({
  q,
  position,
  isFirst,
  isLast,
  flagged,
  onChange,
  onRemove,
  onMove,
  readOnlyStructure = false,
}: {
  q: DraftQuestion;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  flagged: boolean;
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  /**
   * Editing a published paper: the text is fully editable, but reordering or
   * deleting a question would orphan the answers recorded against it, so those
   * controls are hidden rather than offered and then refused.
   */
  readOnlyStructure?: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);

  // A true/false paper marks every statement, and a "multi" question can accept
  // several options, so only "single" behaves like a radio group.
  const manyCorrect = q.type === "multi" || q.type === "tf";
  const correct = q.options.filter((o) => o.correct);

  const patchOption = (i: number, patch: Partial<DraftQuestion["options"][number]>) =>
    onChange({ ...q, options: q.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  const toggleCorrect = (i: number) =>
    manyCorrect
      ? patchOption(i, { correct: !q.options[i].correct })
      : onChange({ ...q, options: q.options.map((o, j) => ({ ...o, correct: j === i })) });

  const addOption = () =>
    onChange({
      ...q,
      options: [
        ...q.options,
        {
          // Continue whichever labelling the question already uses.
          L: /^\d+$/.test(q.options.at(-1)?.L ?? "")
            ? String(q.options.length + 1)
            : String.fromCharCode(65 + q.options.length),
          text: "",
          text_si: null,
          correct: false,
        },
      ],
    });

  return (
    <article
      className={`rounded-xl border p-4 ${
        flagged ? "border-amber/50 bg-amber-wash/40" : "border-rule bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-teal-deep px-2 py-0.5 text-[11px] font-bold text-white">
            Q{position}
          </span>
          <select
            value={q.type}
            onChange={(e) => onChange({ ...q, type: e.target.value })}
            title="Answer type"
            className="rounded border border-rule bg-paper/60 px-1.5 py-0.5 text-[11px] font-semibold text-ink outline-none focus:border-teal"
          >
            <option value="single">single</option>
            <option value="multi">multi</option>
            <option value="tf">true/false</option>
          </select>
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
          <span className={correct.length ? "text-verdict-true-ink" : "text-verdict-false-ink"}>
            {correct.length
              ? `answer ${correct.map((o) => o.L).join(", ")}`
              : q.type === "tf"
                ? "nothing marked true"
                : "no answer"}
          </span>

          <span className={`flex items-center gap-0.5 ${readOnlyStructure ? "hidden" : ""}`}>
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={isFirst}
              title="Move up"
              className="rounded px-1 text-ink-faint hover:bg-paper-dim hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={isLast}
              title="Move down"
              className="rounded px-1 text-ink-faint hover:bg-paper-dim hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onRemove}
              title="Delete this question"
              className="rounded px-1 text-ink-faint hover:bg-verdict-false hover:text-verdict-false-ink"
            >
              ✕
            </button>
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

      {/*
        The circle beside each option toggles it too, but that is easy to miss —
        it reads as a bullet rather than a control. This is the same action stated
        plainly, and it is the one field that decides whether a student can score
        the question at all.
      */}
      <div
        className={`mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${
          correct.length ? "bg-teal-wash" : "bg-verdict-false"
        }`}
      >
        <span
          className={`text-[12px] font-semibold ${
            correct.length ? "text-teal-deep" : "text-verdict-false-ink"
          }`}
        >
          {manyCorrect ? "Correct answers" : "Correct answer"}
        </span>
        {q.options.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleCorrect(i)}
            className={`h-7 min-w-7 px-1.5 text-[12px] font-bold transition ${
              manyCorrect ? "rounded" : "rounded-full"
            } ${
              o.correct
                ? "bg-teal-deep text-white"
                : "border border-rule bg-card text-ink-soft hover:border-teal hover:text-teal-deep"
            }`}
          >
            {o.L}
          </button>
        ))}
        {!correct.length && (
          <span className="text-[11px] text-verdict-false-ink">
            {manyCorrect ? "nothing marked yet" : "none set — this question cannot be scored"}
          </span>
        )}
      </div>

      <FigureUpload image={q.image} onChange={(url) => onChange({ ...q, image: url })} />

      <ul className="mt-3 space-y-2">
        {q.options.map((o, i) => (
          <li key={i} className="flex items-start gap-2">
            <button
              type="button"
              title={
                manyCorrect ? "Toggle whether this one is correct" : "Mark as the correct answer"
              }
              onClick={() => toggleCorrect(i)}
              className={`mt-0.5 h-5 w-5 flex-none border text-[10px] font-bold ${
                manyCorrect ? "rounded" : "rounded-full"
              } ${
                o.correct
                  ? "border-teal-deep bg-teal-deep text-white"
                  : "border-rule text-ink-faint hover:border-teal"
              }`}
            >
              {o.L}
            </button>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex gap-1">
                <input
                  value={o.L}
                  onChange={(e) => patchOption(i, { L: e.target.value })}
                  title="Option label"
                  className="w-9 flex-none rounded border border-rule bg-paper/60 px-1 py-1 text-center text-[13px] font-semibold text-ink outline-none focus:border-teal focus:bg-card"
                />
                <input
                  value={o.text}
                  onChange={(e) => patchOption(i, { text: e.target.value })}
                  placeholder={`Option ${o.L} (English)`}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...q, options: q.options.filter((_, j) => j !== i) })
                  }
                  title="Remove this option"
                  className="flex-none rounded px-1.5 text-ink-faint hover:bg-verdict-false hover:text-verdict-false-ink"
                >
                  ✕
                </button>
              </span>

              <input
                value={o.text_si ?? ""}
                onChange={(e) => patchOption(i, { text_si: orNull(e.target.value) })}
                placeholder={`Option ${o.L} (Sinhala)`}
                className={`sinhala-note ${inputClass}`}
              />

              {showDetail && (
                <>
                  <textarea
                    rows={2}
                    value={o.exp ?? ""}
                    onChange={(e) => patchOption(i, { exp: orNull(e.target.value) })}
                    placeholder={`Why ${o.L} is ${o.correct ? "right" : "wrong"} (English)`}
                    className={inputClass}
                  />
                  <textarea
                    rows={2}
                    value={o.exp_si ?? ""}
                    onChange={(e) => patchOption(i, { exp_si: orNull(e.target.value) })}
                    placeholder={`Why ${o.L} is ${o.correct ? "right" : "wrong"} (Sinhala)`}
                    className={`sinhala-note ${inputClass}`}
                  />
                </>
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

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-rule pt-3 text-[12px]">
        <button
          type="button"
          onClick={addOption}
          className="rounded-full border border-rule px-3 py-1 font-semibold text-teal-deep transition hover:border-teal hover:bg-teal-wash"
        >
          + Add option
        </button>
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="font-semibold text-ink-soft underline-offset-2 hover:text-teal hover:underline"
        >
          {showDetail ? "Hide" : "Edit"} note &amp; explanations
        </button>
      </div>

      {showDetail && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-rule bg-paper/40 p-3">
          <textarea
            rows={2}
            value={q.exp ?? ""}
            onChange={(e) => onChange({ ...q, exp: orNull(e.target.value) })}
            placeholder="Explanation for the whole question (English)"
            className={areaClass}
          />
          <textarea
            rows={2}
            value={q.exp_si ?? ""}
            onChange={(e) => onChange({ ...q, exp_si: orNull(e.target.value) })}
            placeholder="Explanation for the whole question (Sinhala)"
            className={`sinhala-note ${areaClass}`}
          />
          <input
            value={q.note ?? ""}
            onChange={(e) => onChange({ ...q, note: orNull(e.target.value) })}
            placeholder="Note — e.g. source PDF or marking-scheme caveat (English)"
            className={inputClass}
          />
          <input
            value={q.note_si ?? ""}
            onChange={(e) => onChange({ ...q, note_si: orNull(e.target.value) })}
            placeholder="Note (Sinhala)"
            className={`sinhala-note ${inputClass}`}
          />
          <input
            value={q.image ?? ""}
            onChange={(e) => onChange({ ...q, image: orNull(e.target.value) })}
            placeholder="Figure path, e.g. /api/media/…"
            className={`${inputClass} font-mono`}
          />
        </div>
      )}
    </article>
  );
}
