import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer id="about" className="mt-24 border-t border-rule bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-deep font-serif text-[15px] font-bold text-white"
            >
              Rx
            </span>
            <span className="font-serif text-lg font-semibold text-ink">Past Paper Discussion</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-soft">
            A study companion for the Ceylon Medical College Council External Pharmacists&apos;
            Examination. Every statement carries a worked explanation in English and Sinhala.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Study</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            <li>
              <Link href="/#papers" className="transition hover:text-teal-deep">
                Browse papers
              </Link>
            </li>
            <li>
              <Link href="/attempts" className="transition hover:text-teal-deep">
                My attempts
              </Link>
            </li>
            <li>
              <Link href="/register" className="transition hover:text-teal-deep">
                Create an account
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Note</h3>
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            Answers follow standard UK/BNF-aligned pharmacology and physiology teaching. A few items
            (for example exact mg cut-offs) vary by source — cross-check anything you are unsure of
            against your course notes.
          </p>
        </div>
      </div>

      <div className="border-t border-rule">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-ink-faint">
          Built for pharmacy students in Sri Lanka. Not affiliated with the Ceylon Medical College
          Council.
        </p>
      </div>
    </footer>
  );
}
