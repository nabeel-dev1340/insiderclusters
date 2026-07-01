import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

// Shared marketing chrome for public, crawlable pages (landing, pricing,
// legal, ticker pages). Keeping one header/footer keeps navigation and the
// internal-link graph consistent, which helps both users and crawlers.

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
            IC
          </span>
          InsiderClusters
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pricing"
            className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <ButtonLink href="/login" variant="secondary" size="sm">
            Sign in
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <span>© {new Date().getFullYear()} InsiderClusters</span>
          <span className="text-xs">
            A product by{" "}
            <a
              href="https://beelodev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Beelodev
            </a>
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <a
            href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            SEC EDGAR
          </a>
        </nav>
      </div>
      <div className="mx-auto max-w-5xl px-6 pb-8 text-xs text-muted">
        Data sourced from public SEC Form 4 filings. InsiderClusters is an
        informational tool and does not provide investment advice. Nothing here
        is a recommendation to buy or sell any security.
      </div>
    </footer>
  );
}
