"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Interactive marketing-nav island: active-link highlighting (usePathname) and
// a mobile menu (useState). Kept separate from site-chrome so the header shell
// and the footer can stay server-rendered — this is the only client JS the
// public chrome ships.

const LINKS = [
  { href: "/stocks", label: "Stocks" },
  { href: "/insiders", label: "Insiders" },
  { href: "/pricing", label: "Pricing" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Close the menu on navigation. Resetting state during render when a value
  // changes is React's recommended pattern over an effect (avoids a wasted
  // render + the set-state-in-effect smell).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Close on Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex items-center gap-1">
      {/* Desktop links */}
      <nav className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              isActive(pathname, l.href)
                ? "bg-surface-muted font-medium text-foreground"
                : "text-muted hover:bg-surface-muted/60 hover:text-foreground"
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <span className="mx-1.5 hidden h-5 w-px bg-border md:block" aria-hidden />

      <Link
        href="/login"
        className="hidden rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground md:inline-flex"
      >
        Sign in
      </Link>
      <ButtonLink href="/login" size="sm">
        Get started
      </ButtonLink>

      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="ml-1 grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground md:hidden"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mobile menu: backdrop + panel, kept mounted so both open/close animate.
          The whole block is display:none on md+ so it costs nothing there. */}
      <div className="md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
        <div
          data-open={open}
          onClick={() => setOpen(false)}
          aria-hidden
          className="fixed inset-0 z-30 bg-foreground/10 backdrop-blur-[1px] transition-opacity duration-200 data-[open=false]:pointer-events-none data-[open=false]:opacity-0"
        />
        <div
          id="mobile-menu"
          data-open={open}
          className={cn(
            "fixed inset-x-0 top-16 z-40 origin-top border-b border-border bg-surface shadow-lg transition duration-200",
            "data-[open=false]:pointer-events-none data-[open=false]:-translate-y-2 data-[open=false]:opacity-0"
          )}
        >
          <nav className="flex flex-col gap-1 p-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive(pathname, l.href)
                    ? "bg-surface-muted font-medium text-foreground"
                    : "text-muted hover:bg-surface-muted/60 hover:text-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-muted/60 hover:text-foreground"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
