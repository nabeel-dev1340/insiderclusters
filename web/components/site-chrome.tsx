import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";

// Shared marketing chrome for public, crawlable pages (landing, pricing,
// legal, ticker pages). Keeping one header/footer keeps navigation and the
// internal-link graph consistent, which helps both users and crawlers.

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="InsiderClusters home"
      className={cn(
        "group inline-flex items-center gap-2.5 font-semibold tracking-tight",
        className
      )}
    >
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-linear-to-br from-accent to-accent-hover text-white ring-1 ring-inset ring-white/20 transition-transform duration-200 group-hover:-translate-y-0.5">
        <BrandMark className="h-4.5 w-4.5" />
      </span>
      <span className="text-[15px]">InsiderClusters</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pricing"
            className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground sm:block"
          >
            Sign in
          </Link>
          <ButtonLink href="/login" size="sm">
            Get started
          </ButtonLink>
        </nav>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <Container className="py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-sm text-muted">
              High-signal insider cluster-buy alerts, sourced straight from SEC
              Form 4 filings.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
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

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} InsiderClusters · A product by{" "}
            <a
              href="https://beelodev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Beelodev
            </a>
          </span>
          <span className="max-w-md sm:text-right">
            Informational only — not investment advice. Data from public SEC
            filings.
          </span>
        </div>
      </Container>
    </footer>
  );
}
