import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-slate-950">
          External Pharmacy Exam Past Paper Discussion
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 md:flex">
          <Link href="#papers" className="transition hover:text-slate-900">
           Papers
          </Link>
          <Link href="#about" className="transition hover:text-slate-900">
            About
          </Link>
          <Link href="#contact" className="transition hover:text-slate-900">
            Contact
          </Link>
        </nav>

        <Link
          href="#enroll"
          className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
         Sign In
        </Link>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <div className="space-y-8">
            <div className="max-w-xl space-y-4">
              <p className="inline-flex rounded-full bg-blue-100 px-4 py-1 text-sm font-semibold text-blue-700">
                Empowering online learning
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Interactive Paper Discussion With Answers.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Find expert-led courses, live workshops, and study resources designed to help medical students and professionals grow with confidence.
              </p>
            </div>
          </div>
        </section>

        <section id="papers" className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            { title: "2020 External Pharmacist MCQ", description: "Learn from specialists with real clinical experience." },
            { title: "2021 External Pharmacist MCQ", description: "Practice cases, quizzes, and live Q&A sessions." },
            { title: "2022 External Pharmacist MCQ", description: "Earn a completion certificate to showcase your skills." },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200/50">
              <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
