import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LogoTile } from "@/components/logo";
import { SiteNav } from "@/components/site-nav";
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
        "wordmark group inline-flex items-center gap-2.5 font-semibold tracking-tight",
        className,
      )}
    >
      <LogoTile className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      <span className="text-[16px] sm:text-[19px]">
        Insider<span className="font-normal">Clusters</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-border">
      <Container className="flex h-18 items-center justify-between gap-3">
        <Wordmark />
        <SiteNav />
      </Container>
    </header>
  );
}

// Real, existing destinations only — we never link a page that doesn't exist.
const FOOTER_COLUMNS: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}[] = [
  {
    title: "Product",
    links: [
      { label: "Stocks", href: "/stocks" },
      { label: "Insiders", href: "/insiders" },
      { label: "Sectors", href: "/sectors" },
      { label: "Monthly archive", href: "/insider-buying" },
      { label: "Learn", href: "/learn" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/login" },
    ],
  },
  {
    title: "About & data",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      {
        label: "SEC EDGAR",
        href: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4",
        external: true,
      },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer relative mt-auto border-t border-border">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-sm text-muted">
              A clearer view of insider buying. Independent research tools built
              from public SEC Form 4 filings.
            </p>
            <Link href="/methodology" className="text-link mt-3">
              Read our methodology <span aria-hidden>↗</span>
            </Link>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                        <span aria-hidden className="text-[10px]">
                          ↗
                        </span>
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="inline-flex min-h-8 items-center text-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
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
