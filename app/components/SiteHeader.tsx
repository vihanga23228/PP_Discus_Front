"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";

function initials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const label = user.displayName || user.username;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-rule bg-card py-1 pl-1 pr-3 text-sm font-medium text-ink transition hover:border-teal/40 hover:shadow-sm"
      >
        {user.avatarUrl ? (
          // Google avatars are remote; a plain img avoids next/image host config
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-deep text-xs font-semibold text-white">
            {initials(label)}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate sm:block">{label}</span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-rule bg-card shadow-lift"
        >
          <div className="border-b border-rule px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{label}</p>
            <p className="truncate text-xs text-ink-faint">{user.email}</p>
            {user.role === "ADMIN" && (
              <span className="mt-2 inline-flex rounded-full bg-amber-wash px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber">
                Administrator
              </span>
            )}
          </div>
          <Link
            href="/attempts"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-ink-soft transition hover:bg-paper hover:text-ink"
          >
            My attempts
          </Link>
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block border-t border-rule px-4 py-2.5 text-sm font-semibold text-teal-deep transition hover:bg-teal-wash"
            >
              Admin console
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              logout();
              setOpen(false);
              router.push("/");
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-verdict-false-ink transition hover:bg-verdict-false"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { href: "/#papers", label: "Papers" },
  { href: "/#how", label: "How it works" },
  { href: "/#about", label: "About" },
];

export default function SiteHeader() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-rule/70 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="group flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-deep font-serif text-[15px] font-bold text-white shadow-sm"
          >
            Rx
          </span>
          <span className="leading-tight">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-teal sm:block">
              External Pharmacy Exam
            </span>
            <span className="block whitespace-nowrap font-serif text-sm font-semibold text-ink sm:text-[15px]">
              Past Paper Discussion
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-soft lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-teal-deep">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {loading ? (
            <span className="h-9 w-24 animate-pulse rounded-full bg-paper-dim" />
          ) : user ? (
            <UserMenu />
          ) : (
            <>
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-ink-soft transition hover:text-teal-deep"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-full bg-teal-deep px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
