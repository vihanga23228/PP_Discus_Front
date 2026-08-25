"use client";

import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export default function FormField({ label, hint, error, id, ...input }: Props) {
  const fieldId = id ?? input.name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <label className="block" htmlFor={fieldId}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        {...input}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-2 w-full rounded-xl border bg-paper/60 px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:bg-card focus:ring-4 ${
          error
            ? "border-verdict-false-ink/50 focus:border-verdict-false-ink focus:ring-verdict-false"
            : "border-rule focus:border-teal focus:ring-teal-wash"
        }`}
      />
      {error ? (
        <span id={`${fieldId}-error`} className="mt-1.5 block text-xs text-verdict-false-ink">
          {error}
        </span>
      ) : hint ? (
        <span id={`${fieldId}-hint`} className="mt-1.5 block text-xs text-ink-faint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
