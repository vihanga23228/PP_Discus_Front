"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/users", label: "Members" },
  { href: "/admin/catalogue", label: "Catalogue" },
  { href: "/admin/import", label: "Import PDF" },
  { href: "/admin/papers", label: "Upload JSON" },
];

function Denied() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md rounded-2xl border border-rule bg-card p-8 text-center shadow-paper">
        <h1 className="font-serif text-2xl font-semibold text-ink">Administrators only</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Your account does not have access to the admin console.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-teal-deep px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal"
        >
          Back to the site
        </Link>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-rule border-t-teal-deep" />
      </div>
    );
  }

  if (user.role !== "ADMIN") return <Denied />;

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col border-r border-rule bg-teal-deep px-4 py-5 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 font-serif text-sm font-bold text-teal-deep"
          >
            Rx
          </span>
          <span className="leading-tight text-white">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Admin console
            </span>
            <span className="block font-serif text-sm font-semibold">Past Paper Discussion</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/15 pt-4">
          <p className="truncate px-3 text-sm font-medium text-white">
            {user.displayName || user.username}
          </p>
          <p className="truncate px-3 text-xs text-white/50">{user.email}</p>
          <div className="mt-3 space-y-1">
            <Link
              href="/"
              className="block rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              View the site
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-rule bg-teal-deep px-4 py-2.5 lg:hidden">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  active ? "bg-white text-teal-deep" : "text-white/70"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link href="/" className="ml-auto whitespace-nowrap px-3 text-sm text-white/70">
            Site
          </Link>
        </div>

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
