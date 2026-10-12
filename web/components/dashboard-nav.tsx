"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { LogoTile } from "@/components/logo";

const LINKS = [
  { href: "/dashboard", label: "Feed" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav({
  email,
  plan,
}: {
  email: string;
  plan: "none" | "basic" | "pro";
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <LogoTile className="h-7 w-7 transition-transform duration-200 group-hover:-translate-y-0.5" />
            <span className="hidden sm:inline">InsiderClusters</span>
          </Link>
          <nav
            aria-label="Dashboard navigation"
            className="flex items-center gap-1"
          >
            {LINKS.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-3 text-sm transition-colors",
                    active
                      ? "bg-surface-muted font-medium text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge
            tone={plan === "none" ? "muted" : "accent"}
            className="uppercase"
          >
            {plan === "pro" ? "Pro" : plan === "basic" ? "Basic" : "No plan"}
          </Badge>
          <span className="hidden max-w-56 truncate text-xs text-muted lg:inline">
            {email}
          </span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md px-2.5 py-3 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
