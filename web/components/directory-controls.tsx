import Link from "next/link";
import type { DirectoryQuery } from "@/lib/directory-query";
import { Button } from "@/components/ui/button";

export function DirectoryControls({
  path,
  query,
  label = "Search by ticker or company",
  sorts = true,
}: {
  path: string;
  query: DirectoryQuery;
  label?: string;
  sorts?: boolean;
}) {
  return (
    <form action={path} method="get" className="directory-tools">
      <label className="sr-only" htmlFor="directory-search">
        {label}
      </label>
      <input
        id="directory-search"
        name="q"
        type="search"
        maxLength={100}
        defaultValue={query.q}
        placeholder={label}
      />
      {sorts && (
        <>
          <label className="sr-only" htmlFor="directory-sort">
            Sort stocks
          </label>
          <select id="directory-sort" name="sort" defaultValue={query.sort}>
            <option value="recent">Latest activity</option>
            <option value="clusters">Most clusters</option>
            <option value="name">Ticker A–Z</option>
          </select>
        </>
      )}
      <Button type="submit" size="sm">
        Search
      </Button>
      {(query.q || query.sort !== "recent") && (
        <Link href={path} className="text-link">
          Reset
        </Link>
      )}
    </form>
  );
}

export function DirectoryPagination({
  page,
  pages,
  href,
  label,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  label: string;
}) {
  if (pages <= 1) return null;
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);
  return (
    <nav
      aria-label={label}
      className="mt-6 flex flex-wrap items-center gap-2 text-sm"
    >
      {page > 1 && (
        <Link
          prefetch={false}
          href={href(page - 1)}
          className="rounded-sm border border-border px-3 py-3"
        >
          Previous
        </Link>
      )}
      {numbers.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 && p - numbers[i - 1]! > 1 && <span aria-hidden>…</span>}
          <Link
            prefetch={false}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`rounded-sm border px-4 py-3 ${p === page ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link
          prefetch={false}
          href={href(page + 1)}
          className="rounded-sm border border-border px-3 py-3"
        >
          Next
        </Link>
      )}
      <span className="text-muted">
        Page {page} of {pages}
      </span>
    </nav>
  );
}
