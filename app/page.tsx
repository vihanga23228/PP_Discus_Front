import Link from "next/link";
import SubjectCatalogue from "./components/SubjectCatalogue";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";

const STATS = [
  { value: "50", label: "questions in the 2020 paper" },
  { value: "246", label: "individually marked statements" },
  { value: "2", label: "languages for every explanation" },
];

const STEPS = [
  {
    n: "01",
    title: "Pick a subject",
    body: "Start from the subject you are studying, such as Pharmacy.",
  },
  {
    n: "02",
    title: "Choose the exam",
    body: "Each subject lists the examinations sat under it.",
  },
  {
    n: "03",
    title: "Pick the year",
    body: "Open that year's paper and work through it statement by statement.",
  },
];

const FEATURES = [
  {
    title: "Marked statement by statement",
    body: "True/false questions are scored the way the printed paper is: five statements, five marks. You see exactly which ones cost you.",
  },
  {
    title: "Explanations in Sinhala too",
    body: "Every option carries a worked explanation in English, with a Sinhala reading underneath it.",
  },
  {
    title: "Answer, then understand",
    body: "Nothing is revealed until you commit to an answer. Check a question and the reasoning opens up beneath it.",
  },
  {
    title: "Your attempts are kept",
    body: "Scores are saved to your account, so you can see how a paper went the last time you sat it.",
  },
];

/** A static preview of the real question interface, used as hero artwork. */
function PaperPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-3 rotate-1 rounded-2xl border border-rule bg-card/60"
      />
      <div className="relative rounded-2xl border border-rule bg-card p-6 shadow-lift">
        <span className="inline-block rounded-full bg-teal-deep px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
          Question 1
        </span>

        <p className="mt-3 font-serif text-lg leading-snug text-ink">
          True or false regarding lipids?
        </p>

        <div className="mt-4 space-y-1.5">
          {[
            { l: "A", text: "Saturated fatty acids contain double bonds", verdict: "F" as const },
            { l: "C", text: "Cholesterol is a precursor of vitamin D", verdict: "T" as const },
          ].map((row) => (
            <div
              key={row.l}
              className={`flex items-start gap-3 rounded-lg px-2.5 py-2 ${
                row.verdict === "T" ? "bg-verdict-true" : "bg-verdict-false"
              }`}
            >
              <span className="pt-0.5 text-[13px] font-bold text-teal-deep">{row.l}.</span>
              <span className="flex-1 text-[13.5px] leading-snug text-ink">{row.text}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
                  row.verdict === "T" ? "bg-verdict-true-ink" : "bg-verdict-false-ink"
                }`}
              >
                {row.verdict === "T" ? "True" : "False"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg bg-paper px-3 py-2.5">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">C. True.</span> 7-dehydrocholesterol is
            converted to cholecalciferol in the skin under UV light.
          </p>
          <p className="sinhala-note mt-2 text-[12.5px]">
            නිවැරදියි — කොලෙස්ටරෝල් වලින් සෑදෙන 7-dehydrocholesterol, හිරු එළියේදී සමේ විටමින් D3 බවට පත් වේ.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="paper-glow relative overflow-hidden">
          <div className="paper-grid absolute inset-0 -z-10" aria-hidden="true" />
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal-wash px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                English &amp; Sinhala
              </span>

              <h1 className="mt-6 text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.2rem]">
                Past papers you actually{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">work through.</span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-1.5 -z-0 h-3 rounded bg-amber/25"
                  />
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
                Sit the STEM Examination past papers one statement at a time.
                Commit to True or False(Choose Correct Answer), check the question, and read exactly why each answer is
                what it is — in English and in Sinhala.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="#papers"
                  className="rounded-full bg-teal-deep px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal"
                >
                  Browse the papers
                </Link>
                <Link
                  href="/register"
                  className="rounded-full border border-rule bg-card px-6 py-3 text-sm font-semibold text-ink transition hover:border-teal/40 hover:text-teal-deep"
                >
                  Create a free account
                </Link>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-rule pt-7">
                {STATS.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block font-serif text-3xl font-semibold text-teal-deep">
                        {stat.value}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-ink-faint">
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <PaperPreview />
          </div>
        </section>

        {/* Papers */}
        <section id="papers" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">
                The catalogue
              </span>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">
                Subject, then exam, then year
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-ink-soft">
              Three steps to a paper. You will be asked to sign in before the questions load.
            </p>
          </div>

          <div className="mt-10">
            <SubjectCatalogue />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-rule bg-card">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">
              How it works
            </span>
            <h2 className="mt-2 max-w-2xl font-serif text-3xl font-semibold text-ink sm:text-4xl">
              Three steps from the front page to a marked paper
            </h2>

            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.n} className="relative pl-14">
                  <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-teal/25 bg-teal-wash font-serif text-sm font-bold text-teal-deep">
                    {step.n}
                  </span>
                  <h3 className="font-serif text-xl font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-rule bg-card p-7 shadow-paper"
              >
                <h3 className="font-serif text-xl font-semibold text-ink">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{feature.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl bg-teal-deep px-8 py-12 text-center sm:px-14">
            <h2 className="font-serif text-3xl font-semibold text-white sm:text-4xl">
              Start with the 2020 paper
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/75">
              Fifty questions, two hundred and forty-six marked statements, every one of them
              explained.
            </p>
            <Link
              href="#papers"
              className="mt-8 inline-block rounded-full bg-white px-7 py-3 text-sm font-semibold text-teal-deep transition hover:bg-paper"
            >
              Open the catalogue
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
