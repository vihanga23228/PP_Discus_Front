"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AdminStats } from "../lib/types";

function relative(value: string | null): string {
  if (!value) return "never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";

  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

interface TileProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

function Tile({ label, value, sub, accent }: TileProps) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-paper ${
        accent ? "border-teal/25 bg-teal-deep text-white" : "border-rule bg-card"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
          accent ? "text-white/60" : "text-teal"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 font-serif text-4xl font-semibold ${
          accent ? "text-white" : "text-teal-deep"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className={`mt-1 text-xs ${accent ? "text-white/55" : "text-ink-faint"}`}>{sub}</p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .admin.stats(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setStats(data);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load the dashboard.");
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-amber/30 bg-amber-wash/60 p-6 text-sm leading-6 text-ink-soft">
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-paper-dim" />
        ))}
      </div>
    );
  }

  const { members, content, activity } = stats;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Members, content and activity across the site.
        </p>
      </header>

      {/* Members */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-teal">
          Members
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label="Registered members"
            value={members.total}
            sub={`${members.admins} administrator${members.admins === 1 ? "" : "s"}`}
          />
          <Tile
            label="Active members"
            value={members.active}
            sub="signed in within 30 days"
            accent
          />
          <Tile
            label="Active this week"
            value={members.activeThisWeek}
            sub="signed in within 7 days"
          />
          <Tile
            label="New this week"
            value={members.newThisWeek}
            sub={
              members.suspended > 0
                ? `${members.suspended} suspended`
                : `${members.neverSignedIn} never signed in`
            }
          />
        </div>
      </section>

      {/* Content + activity */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-teal">
          Content &amp; activity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Subjects" value={content.subjects} />
          <Tile label="Exams" value={content.exams} sub="across all subjects" />
          <Tile label="Papers" value={content.papers} sub={content.questions + " questions"} />
          <Tile
            label="Papers completed"
            value={activity.completedAttempts}
            sub={`${activity.totalAttempts} started · avg ${activity.averageScorePct}%`}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent signups */}
        <section className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-ink">Newest members</h2>
            <Link
              href="/admin/users"
              className="text-sm font-semibold text-teal-deep underline underline-offset-4"
            >
              Manage
            </Link>
          </div>

          {stats.recentSignups.length === 0 ? (
            <p className="mt-6 text-sm text-ink-faint">No members yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {stats.recentSignups.map((u) => (
                <li key={u.id} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-wash text-xs font-semibold text-teal-deep">
                    {(u.displayName || u.username).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {u.displayName || u.username}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">{u.email}</span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block text-xs text-ink-soft">{relative(u.createdAt)}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {u.lastLoginAt ? `seen ${relative(u.lastLoginAt)}` : "never signed in"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent attempts */}
        <section className="rounded-2xl border border-rule bg-card p-6 shadow-paper">
          <h2 className="font-serif text-lg font-semibold text-ink">Latest completed papers</h2>

          {stats.recentAttempts.length === 0 ? (
            <p className="mt-6 text-sm text-ink-faint">
              Nobody has finished a paper yet. Scores appear here as members complete them.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {stats.recentAttempts.map((a) => (
                <li key={a.attemptId} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {a.username}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">{a.paperTitle}</span>
                  </span>
                  <span className="flex-none text-xs text-ink-soft">
                    {a.earnedMarks}/{a.totalMarks}
                  </span>
                  <span
                    className={`flex-none rounded-full px-2.5 py-1 text-xs font-bold ${
                      a.scorePct >= 50
                        ? "bg-verdict-true text-verdict-true-ink"
                        : "bg-verdict-false text-verdict-false-ink"
                    }`}
                  >
                    {Math.round(a.scorePct)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
