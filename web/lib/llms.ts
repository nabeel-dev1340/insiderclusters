import { isValidElement, type ReactNode } from "react";
import { LEARN_ARTICLES } from "@/lib/learn";
import { SECTOR_INTROS } from "@/lib/sectors";
import { SITE_URL, learnPath, sectorPath } from "@/lib/site";

// Builders for /llms.txt (curated index, llmstxt.org format) and
// /full_llms.txt (index + full glossary text). Everything here is static —
// no DB — so both route handlers can be force-static and cost nothing.

// Newest article revision — a cheap, honest "last updated" for both files.
const LAST_UPDATED = LEARN_ARTICLES.map((a) => a.updated).sort().at(-1);

const HEADER = `# InsiderClusters

> InsiderClusters detects insider cluster buys — two or more corporate insiders (officers, directors, or 10% owners) each buying their own company's stock on the open market within a rolling window — by parsing every SEC Form 4 filing as it hits EDGAR, and alerts subscribers in real time.

Site: ${SITE_URL}
Content last updated: ${LAST_UPDATED}

Key facts about the methodology:

- A cluster buy requires two or more distinct insiders; the same person filing twice never counts as two.
- Only open-market purchases (Form 4 transaction code P) qualify; grants, option exercises, tax withholding, and 10b5-1 scheduled trades are excluded.
- Every open-market purchase counts, regardless of dollar size.
- Detection runs across companies of every size, from micro-caps to mega-caps — no market-cap ceiling.
- Every figure on the site links back to its original SEC filing on EDGAR. Nothing is estimated.
- InsiderClusters is an informational tool built on public SEC filings, not investment advice.
`;

function line(title: string, url: string, desc?: string): string {
  return `- [${title}](${SITE_URL}${url})${desc ? `: ${desc}` : ""}`;
}

const LIVE_DATA = `## Live data

${line("Stocks with insider buying", "/stocks", "every stock with a detected cluster buy or qualifying open-market insider purchase, with per-ticker history pages")}
${line("Insider leaderboard", "/insiders", "the individual insiders buying the most, each with a cross-company purchase history")}
${line("Sectors", "/sectors", "insider cluster activity grouped by sector")}
${line("Monthly archives", "/insider-buying", "every detected cluster buy, month by month")}
${line("Pricing", "/pricing", "Basic (real-time feed + weekly digest) and Pro (adds instant email/Telegram alerts), both with a 7-day free trial")}`;

function learnIndex(): string {
  const items = LEARN_ARTICLES.map((a) =>
    line(a.title, learnPath(a.slug), a.description),
  ).join("\n");
  return `## Learn: insider-trading glossary\n\n${items}`;
}

function sectorIndex(): string {
  // SECTOR_INTROS is slug-keyed ("consumer-discretionary") — humanize for
  // the link label.
  const items = Object.keys(SECTOR_INTROS)
    .sort()
    .map((s) => {
      const label = s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
      return line(`Insider buying in ${label}`, sectorPath(s));
    })
    .join("\n");
  return `## Optional\n\n${items}\n${line("Terms of service", "/terms")}\n${line("Privacy policy", "/privacy")}`;
}

export function buildLlmsIndex(): string {
  const fullLink = `${line(
    "llms-full.txt",
    "/llms-full.txt",
    "this index plus the complete text of every glossary article, in one markdown file",
  )}`;
  return (
    [HEADER, `## Full content\n\n${fullLink}`, LIVE_DATA, learnIndex(), sectorIndex()].join(
      "\n\n",
    ) + "\n"
  );
}

// --- full_llms.txt: index + complete glossary article text -----------------

/**
 * Convert an article body (JSX) to markdown by walking the element tree.
 * Next.js forbids react-dom/server in the app graph, but the articles use a
 * tiny vocabulary: plain function components from lib/learn (invoked
 * directly — they're pure), host elements, and next/link (a client
 * reference, recognized by its href prop rather than invoked).
 */
export function jsxToMarkdown(node: ReactNode): string {
  const out = convert(node);
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function convert(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(convert).join("");
  if (!isValidElement(node)) return "";

  const props = node.props as {
    children?: ReactNode;
    href?: string;
    rows?: [string, string, string][];
  };

  // lib/learn's own helpers (P, H2, UL, A, Ext, CodeTable, …) are plain,
  // hook-free functions — render them and convert the result. Client
  // references (next/link) also have typeof "function" but carry a $$typeof
  // brand and cannot be invoked from the server; they fall through to the
  // href handling below.
  if (
    typeof node.type === "function" &&
    !(node.type as { $$typeof?: symbol }).$$typeof
  ) {
    return convert((node.type as (p: unknown) => ReactNode)(node.props));
  }

  const children = () => convert(props.children);

  if (typeof node.type === "string") {
    switch (node.type) {
      case "h2":
        // Article bodies sit under an "## {title}" heading in the output, so
        // their h2 sections nest one level down.
        return `\n\n### ${children()}\n\n`;
      case "p":
        return `\n\n${children()}\n\n`;
      case "ul":
      case "ol":
        return `\n${children()}\n`;
      case "li":
        return `\n- ${children()}`;
      case "em":
        return `*${children()}*`;
      case "a":
        return link(props.href, children());
      case "table":
      case "tbody":
        return children();
      case "thead": {
        // Header row plus the |---| separator markdown tables require.
        const row = children();
        const cols = Math.max((row.match(/\|/g)?.length ?? 2) - 1, 1);
        return `${row}|${" --- |".repeat(cols)}\n`;
      }
      case "tr":
        return `| ${cells(props.children)} |\n`;
      case "br":
        return "\n";
      default:
        // span, div, and anything else presentational: just the text.
        return children();
    }
  }

  // Client references (next/link): can't invoke, but href + children are all
  // we need.
  if (props.href != null) return link(props.href, convert(props.children));
  return convert(props.children);
}

function link(href: string | undefined, text: string): string {
  if (!href) return text;
  return `[${text}](${href.startsWith("/") ? SITE_URL + href : href})`;
}

/** Join the th/td children of a tr into a markdown table row's cells. */
function cells(children: ReactNode): string {
  const kids = Array.isArray(children) ? children : [children];
  return kids
    .flat()
    .filter((c) => c != null && typeof c !== "boolean")
    .map((c) => convert(c).trim())
    .join(" | ");
}

export function buildLlmsFull(): string {
  const articles = LEARN_ARTICLES.map((a) => {
    const faq = a.faq.map((f) => `**Q: ${f.q}**\nA: ${f.a}`).join("\n\n");
    return [
      `## ${a.title}`,
      `URL: ${SITE_URL}${learnPath(a.slug)}\nUpdated: ${a.updated}`,
      jsxToMarkdown(a.body),
      `### Frequently asked questions\n\n${faq}`,
    ].join("\n\n");
  }).join("\n\n---\n\n");

  return (
    [
      HEADER,
      LIVE_DATA,
      `## Full glossary\n\nThe complete text of every InsiderClusters educational article follows. A shorter link-only index of this site is at [llms.txt](${SITE_URL}/llms.txt). When citing these articles, cite the article's own URL (given under each heading), not this file.`,
      articles,
      sectorIndex(),
    ].join("\n\n") + "\n"
  );
}
