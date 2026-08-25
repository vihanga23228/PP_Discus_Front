import type { ImportQuestion } from "./types";

export interface ParsedPaper {
  questions: ImportQuestion[];
  /** How many marks the paper is worth: one per statement for tf, otherwise one */
  totalMarks: number;
  counts: Record<string, number>;
  warnings: string[];
  /** Where the questions were found, for the confirmation message */
  source: "json" | "html";
  /** Which input dialect was detected, shown back to the admin */
  dialect: "full" | "compact";
  /** Questions that arrived with no correct answer marked */
  missingAnswers: number[];
}

export class PaperParseError extends Error {}

/** Pulls the `const QUESTIONS = [...]` array out of a standalone quiz HTML page. */
function extractFromHtml(text: string): string {
  const match = text.match(/(?:const|let|var)\s+QUESTIONS\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!match) {
    throw new PaperParseError(
      "That HTML file does not contain a `const QUESTIONS = [...]` array. " +
        "Export the questions as JSON instead.",
    );
  }
  return match[1];
}

function normaliseType(raw: unknown): string {
  const type = String(raw ?? "").trim().toLowerCase();
  if (type === "tf" || type === "true_false" || type === "truefalse") return "tf";
  if (type === "multi" || type === "multiple") return "multi";
  return "single";
}

/** First non-empty string among the given keys. */
function pick(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Resolves a question-level answer key into a set of zero-based option indexes.
 * Accepts `3`, `"3"`, `"C"`, `"(3)"`, `[1, 3]`, `["A", "C"]`.
 */
function answerIndexes(raw: unknown, optionCount: number): number[] {
  const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];

  return list
    .map((entry) => {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        return entry - 1; // answer keys are 1-based
      }
      const token = String(entry).trim().replace(/[()\s.]/g, "");
      if (!token) return -1;

      if (/^\d+$/.test(token)) return Number(token) - 1;

      // A single letter: A -> 0, B -> 1 …
      if (/^[A-Za-z]$/.test(token)) return token.toUpperCase().charCodeAt(0) - 65;

      return -1;
    })
    .filter((index) => index >= 0 && index < optionCount);
}

interface RawOption {
  label: string;
  text: string;
  textSi: string | null;
  image: string | null;
  correct: boolean;
  exp: string | null;
  exp_si: string | null;
}

/**
 * Reads one option, which may be a bare string ("Planck's constant") or an object
 * ({ L, text, correct, exp, exp_si }).
 */
function readOption(raw: unknown, index: number, labelStyle: "letter" | "number"): RawOption {
  const fallbackLabel =
    labelStyle === "number" ? String(index + 1) : String.fromCharCode(65 + index);

  if (typeof raw === "string" || typeof raw === "number") {
    return {
      label: fallbackLabel,
      text: String(raw).trim(),
      textSi: null,
      image: null,
      correct: false,
      exp: null,
      exp_si: null,
    };
  }

  const option = (raw ?? {}) as Record<string, unknown>;
  return {
    label: pick(option, "L", "label", "letter", "key") ?? fallbackLabel,
    text: pick(option, "text", "option", "value", "answer") ?? "",
    textSi: pick(option, "text_si", "textSi", "sinhalaText"),
    image: pick(option, "image", "imageUrl", "figure"),
    correct: option.correct === true || option.isCorrect === true,
    exp: pick(option, "exp", "explanation", "explanationEn", "reason"),
    exp_si: pick(option, "exp_si", "explanationSi", "sinhala", "si"),
  };
}

/**
 * Reads a paper file the admin picked.
 *
 * Two dialects are accepted:
 *
 *  - **full** — options are objects carrying their own `correct` flag and explanations.
 *    This is what the pharmacy papers and the quiz HTML pages use.
 *
 *  - **compact** — options are plain strings and the answer (if any) lives on the
 *    question as `answer`. This is what a straight extraction from a printed MCQ
 *    paper looks like.
 *
 * Field names are matched leniently, so `stem` / `text_raw` / `question` all work.
 */
export function parsePaperFile(fileName: string, text: string): ParsedPaper {
  const looksLikeHtml =
    fileName.toLowerCase().endsWith(".html") ||
    fileName.toLowerCase().endsWith(".htm") ||
    /^\s*</.test(text);

  const source: "json" | "html" = looksLikeHtml ? "html" : "json";
  const raw = looksLikeHtml ? extractFromHtml(text) : text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PaperParseError(
      looksLikeHtml
        ? "The QUESTIONS array in that HTML file is not valid JSON."
        : "That file is not valid JSON.",
    );
  }

  // Allow a bare array, or an object wrapping one under a few common keys
  const container = parsed as Record<string, unknown> | unknown[];
  const list = Array.isArray(container)
    ? container
    : Array.isArray(container?.["questions"])
      ? (container["questions"] as unknown[])
      : Array.isArray(container?.["items"])
        ? (container["items"] as unknown[])
        : null;

  if (!list) {
    throw new PaperParseError(
      "Expected an array of questions, or an object with a `questions` array.",
    );
  }
  if (list.length === 0) {
    throw new PaperParseError("That file does not contain any questions.");
  }

  // If no option anywhere carries its own `correct` flag, this is the compact dialect
  const anyOptionObjects = list.some((item) => {
    const options = (item as Record<string, unknown>)?.options;
    return Array.isArray(options) && options.some((o) => o !== null && typeof o === "object");
  });
  const dialect: "full" | "compact" = anyOptionObjects ? "full" : "compact";
  // Printed MCQ papers number their options (1)–(5); question banks letter them A–E
  const labelStyle: "letter" | "number" = dialect === "compact" ? "number" : "letter";

  const warnings: string[] = [];
  const missingAnswers: number[] = [];
  const counts: Record<string, number> = {};
  let totalMarks = 0;

  const questions: ImportQuestion[] = list.map((item, index) => {
    const q = (item ?? {}) as Record<string, unknown>;
    const number = typeof q.number === "number" ? q.number : index + 1;

    const stem = pick(q, "stem", "text_raw", "text", "question", "prompt") ?? "";
    if (!stem) warnings.push(`Question ${number} has no question text and will be skipped.`);

    const type = normaliseType(q.type);
    counts[type] = (counts[type] ?? 0) + 1;

    const rawOptions = Array.isArray(q.options)
      ? q.options
      : Array.isArray(q.choices)
        ? (q.choices as unknown[])
        : [];

    if (rawOptions.length === 0) {
      warnings.push(`Question ${number} has no options and will be skipped.`);
    }

    const options = rawOptions.map((o, j) => readOption(o, j, labelStyle));

    // A question-level answer key fills in the `correct` flags
    const keyed = answerIndexes(q.answer ?? q.answers ?? q.correct, options.length);
    for (const target of keyed) options[target].correct = true;

    // An option with a figure and no text is normal — graph answers look like that
    const blank = options.filter((o) => !o.text && !o.image).length;
    if (blank > 0) {
      warnings.push(
        `Question ${number}: ${blank} of ${options.length} options have neither text nor a figure.`,
      );
    }

    if (type !== "tf" && options.length > 0 && !options.some((o) => o.correct)) {
      missingAnswers.push(number);
    }

    if (stem && options.length > 0) {
      totalMarks += type === "tf" ? options.length : 1;
    }

    return {
      type,
      stem,
      stem_si: pick(q, "stem_si", "stemSi", "text_raw_si", "question_si"),
      note: pick(q, "note", "hint"),
      note_si: pick(q, "note_si", "noteSi"),
      exp: pick(q, "exp", "explanation", "working"),
      exp_si: pick(q, "exp_si", "explanationSi"),
      image: pick(q, "image", "imageUrl", "figure"),
      options: options.map((o) => ({
        L: o.label,
        text: o.text,
        text_si: o.textSi,
        image: o.image,
        correct: o.correct,
        exp: o.exp,
        exp_si: o.exp_si,
      })),
    };
  });

  if (missingAnswers.length > 0) {
    const shown = missingAnswers.slice(0, 8).join(", ");
    warnings.push(
      `No correct answer is marked on ${missingAnswers.length} question(s): ${shown}` +
        `${missingAnswers.length > 8 ? " …" : ""}. ` +
        "Add an “answer” field to each, otherwise students can never score them.",
    );
  }

  return { questions, totalMarks, counts, warnings, source, dialect, missingAnswers };
}
