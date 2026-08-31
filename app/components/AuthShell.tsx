import Link from "next/link";
import type { ReactNode } from "react";

const POINTS = [
  "50 questions from the December 2020 paper",
  "Every statement marked and explained",
  "English and Sinhala side by side",
];

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export default function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-teal-deep px-12 py-14 lg:flex lg:w-[44%] lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        <Link href="/" className="relative flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/95 font-serif text-base font-bold text-teal-deep"
          >
            Rx
          </span>
          <span className="leading-tight text-white">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
              STEM Exam Papers
            </span>
            <span className="block font-serif text-base font-semibold">Past Paper Discussion</span>
          </span>
        </Link>

        <div className="relative">
          <h2 className="font-serif text-4xl font-semibold leading-tight text-white">
            The whole paper,
            <br />
            fully explained.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] leading-6 text-white/80">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs leading-5 text-white/45">
          Built for pharmacy students in Sri Lanka. Not affiliated with the Ceylon Medical College
          Council.
        </p>
      </aside>

      {/* Form panel */}
      <main className="paper-grid flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition hover:text-teal-deep lg:hidden"
          >
            <span aria-hidden="true">&larr;</span> Back to home
          </Link>

          <div className="rounded-3xl border border-rule bg-card p-8 shadow-lift sm:p-10">
            <h1 className="font-serif text-3xl font-semibold text-ink">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{subtitle}</p>

            <div className="mt-8">{children}</div>
          </div>

          <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>
        </div>
      </main>
    </div>
  );
}
