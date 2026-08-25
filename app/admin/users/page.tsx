"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { AdminUser, Paged } from "../../lib/types";

const PAGE_SIZE = 20;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function isActive(user: AdminUser): boolean {
  if (!user.lastLoginAt) return false;
  const then = new Date(user.lastLoginAt).getTime();
  return !Number.isNaN(then) && Date.now() - then <= 30 * 24 * 60 * 60 * 1000;
}

export default function AdminUsersPage() {
  const { user: me } = useAuth();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Paged<AdminUser> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) =>
      api.admin
        .users({ search: query, page, size: PAGE_SIZE }, signal)
        .then((result) => {
          if (signal?.aborted) return;
          setData(result);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setError(cause instanceof Error ? cause.message : "Could not load members.");
        }),
    [query, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setQuery(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function mutate(user: AdminUser, body: { role?: string; enabled?: boolean }, message: string) {
    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      await api.admin.updateUser(user.id, body);
      setNotice(message);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That change could not be applied.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(user: AdminUser) {
    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      await api.admin.deleteUser(user.id);
      setNotice(`Deleted ${user.username} and all of their attempts.`);
      setConfirmDelete(null);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That member could not be deleted.");
      setConfirmDelete(null);
    } finally {
      setBusyId(null);
    }
  }

  const users = data?.content ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Members</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {data ? `${data.totalElements} registered` : "Loading…"}
            {data && data.totalElements > 0 && (
              <> · {users.filter(isActive).length} active on this page</>
            )}
          </p>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-full max-w-xs rounded-xl border border-rule bg-card px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-teal focus:ring-4 focus:ring-teal-wash"
        />
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

      {!data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-paper-dim" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-2xl border border-rule bg-card p-10 text-center text-ink-soft">
          {query ? `No members match “${query}”.` : "No members yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-rule bg-card shadow-paper">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-rule text-[11px] uppercase tracking-[0.1em] text-ink-faint">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Member</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last seen</th>
                <th scope="col" className="px-4 py-3 font-semibold">Papers</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = me?.id === u.id;
                const busy = busyId === u.id;

                return (
                  <tr key={u.id} className="border-b border-rule/60 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="h-8 w-8 flex-none rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-wash text-xs font-semibold text-teal-deep">
                            {(u.displayName || u.username).slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium text-ink">
                              {u.displayName || u.username}
                            </span>
                            {self && (
                              <span className="rounded bg-paper-dim px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                                you
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-ink-faint">{u.email}</span>
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!u.enabled ? (
                          <span className="rounded-full bg-verdict-false px-2 py-0.5 text-[11px] font-bold text-verdict-false-ink">
                            Suspended
                          </span>
                        ) : isActive(u) ? (
                          <span className="rounded-full bg-verdict-true px-2 py-0.5 text-[11px] font-bold text-verdict-true-ink">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                            Inactive
                          </span>
                        )}
                        {u.role === "ADMIN" && (
                          <span className="rounded-full bg-amber-wash px-2 py-0.5 text-[11px] font-bold text-amber">
                            Admin
                          </span>
                        )}
                        {u.provider === "GOOGLE" && (
                          <span className="rounded-full border border-rule px-2 py-0.5 text-[11px] text-ink-faint">
                            Google
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-ink-soft">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : "never"}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-soft">
                      {u.attemptCount}
                      {u.bestScorePct != null && (
                        <span className="text-ink-faint"> · best {Math.round(u.bestScorePct)}%</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busy || self}
                          title={self ? "You cannot change your own role" : undefined}
                          onClick={() =>
                            mutate(
                              u,
                              { role: u.role === "ADMIN" ? "USER" : "ADMIN" },
                              u.role === "ADMIN"
                                ? `${u.username} is no longer an administrator.`
                                : `${u.username} is now an administrator.`,
                            )
                          }
                          className="whitespace-nowrap rounded-lg border border-rule px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-teal hover:text-teal-deep disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {u.role === "ADMIN" ? "Make member" : "Make admin"}
                        </button>

                        <button
                          type="button"
                          disabled={busy || self}
                          title={self ? "You cannot suspend yourself" : undefined}
                          onClick={() =>
                            mutate(
                              u,
                              { enabled: !u.enabled },
                              u.enabled
                                ? `${u.username} has been suspended.`
                                : `${u.username} has been restored.`,
                            )
                          }
                          className="whitespace-nowrap rounded-lg border border-rule px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {u.enabled ? "Suspend" : "Restore"}
                        </button>

                        <button
                          type="button"
                          disabled={busy || self}
                          title={self ? "You cannot delete yourself" : undefined}
                          onClick={() => setConfirmDelete(u)}
                          className="whitespace-nowrap rounded-lg border border-rule px-2.5 py-1.5 text-xs font-semibold text-verdict-false-ink transition hover:border-verdict-false-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            className="rounded-lg border border-rule px-3 py-2 font-semibold text-ink-soft transition hover:border-teal disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-ink-faint">
            Page {data.page + 1} of {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-rule px-3 py-2 font-semibold text-ink-soft transition hover:border-teal disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-5"
        >
          <div className="w-full max-w-md rounded-2xl border border-rule bg-card p-6 shadow-lift">
            <h2 id="delete-title" className="font-serif text-xl font-semibold text-ink">
              Delete {confirmDelete.username}?
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              This permanently removes the account and its {confirmDelete.attemptCount} recorded
              attempt{confirmDelete.attemptCount === 1 ? "" : "s"}. This cannot be undone. To keep
              their history, suspend the account instead.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-rule px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-teal"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === confirmDelete.id}
                onClick={() => remove(confirmDelete)}
                className="rounded-lg bg-verdict-false-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busyId === confirmDelete.id ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
