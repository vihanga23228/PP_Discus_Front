"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../lib/api";
import type { Exam, Paper, Subject } from "../../lib/types";

interface ExamNode extends Exam {
  papers: Paper[];
}
interface SubjectNode extends Subject {
  exams: ExamNode[];
}

/** What the edit dialog is currently pointed at. */
type Editing =
  | { kind: "subject"; mode: "create" | "edit"; subject?: Subject }
  | { kind: "exam"; mode: "create" | "edit"; subjectId: number; exam?: Exam }
  | { kind: "paper"; mode: "create" | "edit"; examId: number; paper?: Paper };

const LABEL: Record<Editing["kind"], string> = {
  subject: "subject",
  exam: "exam",
  paper: "year",
};

function EditDialog({
  editing,
  subjects,
  onClose,
  onSaved,
}: {
  editing: Editing;
  subjects: SubjectNode[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = editing.mode === "edit";

  const [name, setName] = useState(() => {
    if (editing.kind === "subject") return editing.subject?.name ?? "";
    if (editing.kind === "exam") return editing.exam?.title ?? "";
    return editing.paper?.title ?? "";
  });
  const [description, setDescription] = useState(() => {
    if (editing.kind === "subject") return editing.subject?.description ?? "";
    if (editing.kind === "exam") return editing.exam?.description ?? "";
    return editing.paper?.description ?? "";
  });
  const [year, setYear] = useState(() =>
    editing.kind === "paper" && editing.paper?.year ? String(editing.paper.year) : "",
  );
  const [duration, setDuration] = useState(() =>
    editing.kind === "paper" && editing.paper?.durationMinutes
      ? String(editing.paper.durationMinutes)
      : "",
  );
  const [moveTo, setMoveTo] = useState(() =>
    editing.kind === "exam" ? String(editing.exam?.subjectId ?? editing.subjectId) : "",
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const trimmed = name.trim();
      const desc = description.trim() || undefined;

      if (editing.kind === "subject") {
        if (isEdit && editing.subject) {
          await api.admin.updateSubject(editing.subject.id, { name: trimmed, description: desc });
          onSaved(`Subject renamed to “${trimmed}”.`);
        } else {
          await api.admin.createSubject({ name: trimmed, description: desc });
          onSaved(`Subject “${trimmed}” created.`);
        }
      } else if (editing.kind === "exam") {
        const subjectId = Number(moveTo);
        if (isEdit && editing.exam) {
          await api.admin.updateExam(editing.exam.id, {
            title: trimmed,
            description: desc,
            subjectId,
          });
          onSaved(`Exam saved as “${trimmed}”.`);
        } else {
          await api.admin.createExam({ title: trimmed, description: desc, subjectId });
          onSaved(`Exam “${trimmed}” created.`);
        }
      } else {
        const body = {
          title: trimmed,
          description: desc,
          year: year ? Number(year) : undefined,
          durationMinutes: duration ? Number(duration) : undefined,
        };
        if (isEdit && editing.paper) {
          await api.admin.updatePaper(editing.examId, editing.paper.id, body);
          onSaved(`Paper saved as “${trimmed}”.`);
        } else {
          await api.admin.createPaper(editing.examId, body);
          onSaved(`Paper “${trimmed}” created.`);
        }
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That change could not be saved.");
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-5"
    >
      <form
        onSubmit={save}
        className="w-full max-w-lg rounded-2xl border border-rule bg-card p-6 shadow-lift"
      >
        <h2 id="edit-title" className="font-serif text-xl font-semibold text-ink">
          {isEdit ? "Edit" : "Add"} {LABEL[editing.kind]}
        </h2>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink"
          >
            {error}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-ink">
              {editing.kind === "subject" ? "Subject name" : editing.kind === "exam" ? "Exam title" : "Paper title"}
            </span>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                editing.kind === "subject"
                  ? "Pharmacy"
                  : editing.kind === "exam"
                    ? "External Pharmacy Exam"
                    : "2021 Paper"
              }
              className="mt-2 w-full rounded-xl border border-rule bg-paper/60 px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-teal focus:bg-card focus:ring-4 focus:ring-teal-wash"
            />
          </label>

          {editing.kind === "paper" && (
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-ink">Year</span>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="2021"
                  className="mt-2 w-full rounded-xl border border-rule bg-paper/60 px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-teal focus:bg-card focus:ring-4 focus:ring-teal-wash"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink">Duration (minutes)</span>
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="120"
                  className="mt-2 w-full rounded-xl border border-rule bg-paper/60 px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-teal focus:bg-card focus:ring-4 focus:ring-teal-wash"
                />
                <span className="mt-1.5 block text-xs text-ink-faint">
                  Blank means the paper is untimed.
                </span>
              </label>
            </div>
          )}

          {editing.kind === "exam" && (
            <label className="block">
              <span className="text-sm font-semibold text-ink">Subject</span>
              <select
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                className="mt-2 w-full rounded-xl border border-rule bg-paper/60 px-4 py-3 text-ink outline-none transition focus:border-teal focus:bg-card focus:ring-4 focus:ring-teal-wash"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              {isEdit && (
                <span className="mt-1.5 block text-xs text-ink-faint">
                  Changing this moves the exam and all of its papers to another subject.
                </span>
              )}
            </label>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-ink">Description</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-xl border border-rule bg-paper/60 px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-teal focus:bg-card focus:ring-4 focus:ring-teal-wash"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-rule px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-teal"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-teal-deep px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink-faint"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminCataloguePage() {
  const [tree, setTree] = useState<SubjectNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchTree = useCallback(async (signal?: AbortSignal): Promise<SubjectNode[]> => {
    const subjects = await api.subjects(signal);
    return Promise.all(
      subjects.map(async (subject) => {
        const exams = await api.examsBySubject(subject.id, signal).catch(() => [] as Exam[]);
        const withPapers = await Promise.all(
          exams.map(async (exam) => ({
            ...exam,
            papers: (await api.papers(exam.id, signal).catch(() => [] as Paper[]))
              .slice()
              .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
          })),
        );
        return { ...subject, exams: withPapers };
      }),
    );
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) =>
      fetchTree(signal)
        .then((data) => {
          if (signal?.aborted) return;
          setTree(data);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setError(cause instanceof Error ? cause.message : "Could not load the catalogue.");
        }),
    [fetchTree],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function remove(kind: Editing["kind"], key: string, run: () => Promise<void>, message: string) {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await run();
      setNotice(message);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `That ${LABEL[kind]} could not be deleted.`);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Catalogue</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            The picker students see: subject, then exam, then year. Rename or move anything here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ kind: "subject", mode: "create" })}
          className="rounded-full bg-teal-deep px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal"
        >
          Add subject
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-verdict-false-ink/25 bg-verdict-false px-4 py-3 text-sm text-verdict-false-ink"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-verdict-true-ink/25 bg-verdict-true px-4 py-3 text-sm text-verdict-true-ink">
          {notice}
        </div>
      )}

      {!tree ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-paper-dim" />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <p className="rounded-2xl border border-rule bg-card p-10 text-center text-ink-soft">
          No subjects yet. Add one to start building the catalogue.
        </p>
      ) : (
        <div className="space-y-5">
          {tree.map((subject) => (
            <section
              key={subject.id}
              className="overflow-hidden rounded-2xl border border-rule bg-card shadow-paper"
            >
              {/* Subject */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule bg-teal-wash/40 px-5 py-4">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal">
                    Subject
                  </span>
                  <h2 className="font-serif text-xl font-semibold text-ink">{subject.name}</h2>
                  {subject.description && (
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-soft">
                      {subject.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {subject.examCount} exams · {subject.paperCount} papers ·{" "}
                    {subject.questionCount} questions
                  </p>
                </div>

                <div className="flex flex-none flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: "subject", mode: "edit", subject })}
                    className="rounded-lg border border-rule bg-card px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ kind: "exam", mode: "create", subjectId: subject.id })
                    }
                    className="rounded-lg border border-rule bg-card px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
                  >
                    Add exam
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === `s${subject.id}`}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete the subject “${subject.name}”?\n\n` +
                            `This also deletes its ${subject.examCount} exam(s), ${subject.paperCount} paper(s), ` +
                            `${subject.questionCount} question(s) and every recorded attempt. This cannot be undone.`,
                        )
                      )
                        return;
                      void remove(
                        "subject",
                        `s${subject.id}`,
                        () => api.admin.deleteSubject(subject.id),
                        `Deleted the subject “${subject.name}”.`,
                      );
                    }}
                    className="rounded-lg border border-rule bg-card px-2.5 py-1.5 text-xs font-semibold text-verdict-false-ink transition hover:border-verdict-false-ink disabled:opacity-40"
                  >
                    {busyKey === `s${subject.id}` ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              {/* Exams */}
              {subject.exams.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-faint">
                  No exams in this subject yet.
                </p>
              ) : (
                <ul className="divide-y divide-rule/60">
                  {subject.exams.map((exam) => (
                    <li key={exam.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                            Exam
                          </span>
                          <h3 className="font-serif text-lg font-semibold text-ink">
                            {exam.title}
                          </h3>
                          {exam.description && (
                            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-ink-soft">
                              {exam.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-none flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                kind: "exam",
                                mode: "edit",
                                subjectId: subject.id,
                                exam,
                              })
                            }
                            className="rounded-lg border border-rule px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
                          >
                            Rename / move
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({ kind: "paper", mode: "create", examId: exam.id })
                            }
                            className="rounded-lg border border-rule px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
                          >
                            Add year
                          </button>
                          <button
                            type="button"
                            disabled={busyKey === `e${exam.id}`}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Delete the exam “${exam.title}”?\n\n` +
                                    `This also deletes its ${exam.paperCount} paper(s), ${exam.questionCount} question(s) ` +
                                    "and every recorded attempt. This cannot be undone.",
                                )
                              )
                                return;
                              void remove(
                                "exam",
                                `e${exam.id}`,
                                () => api.admin.deleteExam(exam.id),
                                `Deleted the exam “${exam.title}”.`,
                              );
                            }}
                            className="rounded-lg border border-rule px-2.5 py-1.5 text-xs font-semibold text-verdict-false-ink transition hover:border-verdict-false-ink disabled:opacity-40"
                          >
                            {busyKey === `e${exam.id}` ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>

                      {/* Papers */}
                      {exam.papers.length === 0 ? (
                        <p className="mt-3 rounded-lg bg-paper/60 px-3 py-2 text-xs text-ink-faint">
                          No years added yet.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-1.5">
                          {exam.papers.map((paper) => (
                            <li
                              key={paper.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper/60 px-3 py-2"
                            >
                              <span className="min-w-0">
                                <span className="text-sm font-medium text-ink">
                                  <span className="font-serif font-semibold text-teal-deep">
                                    {paper.year ?? "—"}
                                  </span>{" "}
                                  · {paper.title}
                                </span>
                                <span className="block text-xs text-ink-faint">
                                  {paper.questionCount} questions
                                  {paper.durationMinutes
                                    ? ` · ${paper.durationMinutes} min`
                                    : " · untimed"}
                                </span>
                              </span>

                              <span className="flex flex-none gap-1.5">
                                <Link
                                  href={`/exams/${exam.id}/papers/${paper.id}`}
                                  className="rounded-lg border border-rule bg-card px-2.5 py-1 text-xs font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
                                >
                                  View
                                </Link>
                                <Link
                                  href={`/admin/papers/${paper.id}/edit?examId=${exam.id}`}
                                  className="rounded-lg border border-teal/40 bg-teal-wash px-2.5 py-1 text-xs font-semibold text-teal-deep transition hover:border-teal hover:bg-teal hover:text-white"
                                >
                                  Edit questions
                                </Link>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditing({
                                      kind: "paper",
                                      mode: "edit",
                                      examId: exam.id,
                                      paper,
                                    })
                                  }
                                  className="rounded-lg border border-rule bg-card px-2.5 py-1 text-xs font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep"
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  disabled={busyKey === `p${paper.id}`}
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        `Delete “${paper.title}” and its ${paper.questionCount} questions?\n\n` +
                                          "Recorded attempts on this paper are removed too. This cannot be undone.",
                                      )
                                    )
                                      return;
                                    void remove(
                                      "paper",
                                      `p${paper.id}`,
                                      () => api.admin.deletePaper(exam.id, paper.id),
                                      `Deleted “${paper.title}”.`,
                                    );
                                  }}
                                  className="rounded-lg border border-rule bg-card px-2.5 py-1 text-xs font-semibold text-verdict-false-ink transition hover:border-verdict-false-ink disabled:opacity-40"
                                >
                                  {busyKey === `p${paper.id}` ? "…" : "Delete"}
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {editing && tree && (
        <EditDialog
          editing={editing}
          subjects={tree}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            setError(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
