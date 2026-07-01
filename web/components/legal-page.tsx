import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

// Shared shell for legal / policy pages. Renders the marketing chrome plus a
// readable, consistently styled document body. Content pages supply their own
// <h2>/<p>/<ul> and inherit spacing + typography from the wrapper.

export function LegalPage({
  title,
  effectiveDate,
  intro,
  children,
}: {
  title: string;
  effectiveDate: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Effective {effectiveDate}</p>
        <p className="mt-6 text-muted">{intro}</p>

        <div
          className="mt-8 space-y-8 leading-relaxed
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight
            [&_p]:mt-3 [&_p]:text-sm [&_p]:text-muted
            [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:text-muted [&_li]:list-disc
            [&_a]:text-accent hover:[&_a]:underline"
        >
          {children}
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
