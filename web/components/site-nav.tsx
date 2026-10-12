"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/stocks", label: "Stocks" },
  { href: "/insiders", label: "Insiders" },
  { href: "/sectors", label: "Sectors" },
  { href: "/insider-buying", label: "Archive" },
  { href: "/learn", label: "Learn" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const toggle = useRef<HTMLButtonElement>(null);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div className="flex items-center gap-3">
      <nav
        aria-label="Main navigation"
        className="hidden items-center gap-5 lg:flex"
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active(link.href) ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center border-b-2 text-xs transition-colors",
              active(link.href)
                ? "border-accent font-semibold text-accent"
                : "border-transparent text-muted hover:text-accent",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/login"
        className="ml-4 hidden min-h-11 items-center text-xs text-muted hover:text-accent xl:flex"
      >
        Sign in
      </Link>
      <ButtonLink href="/login" size="sm" className="header-trial sm:ml-3">
        Start free trial{" "}
        <span aria-hidden className="hidden sm:inline">
          ↗
        </span>
      </ButtonLink>
      <button
        ref={toggle}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
        className="grid h-11 w-11 place-items-center border border-border rounded-sm lg:hidden"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 8h16M4 16h16"} />
        </svg>
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile navigation"
          className="absolute inset-x-0 top-full border-b border-border bg-background p-5 shadow-lg lg:hidden"
        >
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-5">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={active(link.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-13 items-center justify-between border-b border-border text-sm",
                  active(link.href)
                    ? "font-semibold text-accent"
                    : "text-foreground",
                )}
              >
                {link.label}
                <span aria-hidden>↗</span>
              </Link>
            ))}
            <Link
              href="/login"
              className="flex min-h-13 items-center text-sm text-accent"
            >
              Sign in / Start trial →
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
