import { isValidElement, type ReactNode } from "react";
import { slugify } from "@/lib/site";
import Link from "next/link";

// Glossary / education layer (SEO plan P4). Hand-written articles that build
// topical authority around the programmatic pages and give AI search something
// citable. Each article links into the live data surfaces (/stocks, /insiders,
// /sectors) so crawlers and readers both flow from explanation to evidence.

export interface LearnArticle {
  slug: string;
  title: string; // H1 / <title>
  seoTitle?: string; // Short search title when the full article heading is longer.
  description: string; // meta description
  /** Published/updated date shown on the page and in Article schema (ISO). */
  updated: string;
  related: string[]; // slugs
  body: ReactNode;
  /**
   * Mini-FAQ rendered at the end of the article and emitted as FAQPage
   * schema. Plain strings (no JSX) so the visible text and the JSON-LD are
   * guaranteed identical — a requirement for the markup to be valid.
   */
  faq: { q: string; a: string }[];
}

// --- shared typography helpers (keep articles visually identical) ----------

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node))
    return nodeText(node.props.children);
  return "";
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      id={slugify(nodeText(children))}
      className="mt-10 text-xl font-semibold tracking-tight"
    >
      {children}
    </h2>
  );
}

export function articleHeadings(
  article: LearnArticle,
): { id: string; text: string }[] {
  const headings: { id: string; text: string }[] = [];
  function visit(node: ReactNode) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isValidElement<{ children?: ReactNode }>(node)) return;
    if (node.type === H2) {
      const text = nodeText(node.props.children);
      headings.push({ id: slugify(text), text });
    } else visit(node.props.children);
  }
  visit(article.body);
  return headings;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 leading-relaxed text-muted">{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-muted">
      {children}
    </ul>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-foreground">{children}</span>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-accent hover:underline">
      {children}
    </Link>
  );
}

/** External citation — credible primary sources (SEC, investor.gov, research). */
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline"
    >
      {children}
    </a>
  );
}

function CodeTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border">
      <div className="responsive-records overflow-x-auto">
        <table role="table" className="w-full min-w-120 text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                Code
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Meaning
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Signal value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([code, meaning, signal]) => (
              <tr key={code} className="bg-surface">
                <td
                  data-label="Code"
                  className="px-4 py-3 font-mono font-semibold"
                >
                  {code}
                </td>
                <td data-label="Meaning" className="px-4 py-3 text-muted">
                  {meaning}
                </td>
                <td
                  data-label="Interpretation"
                  className="px-4 py-3 text-muted"
                >
                  {signal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- articles ---------------------------------------------------------------

export const LEARN_ARTICLES: LearnArticle[] = [
  {
    slug: "what-is-a-cluster-buy",
    title: "What is an insider cluster buy?",
    description:
      "An insider cluster buy groups qualifying purchases by two or more insiders in the same stock. Learn how detection works and what to verify in SEC filings.",
    updated: "2026-10-12",
    related: [
      "insider-buying-vs-selling",
      "who-counts-as-an-insider",
      "why-small-cap-insider-buying-matters",
    ],
    faq: [
      {
        q: "How many insiders make a cluster buy?",
        a: "A cluster buy requires two or more distinct insiders — officers, directors, or 10% owners — each making an open-market purchase of the same stock within a rolling window.",
      },
      {
        q: "Are cluster buys a bullish signal?",
        a: "Cluster buys can provide a lead for research, but do not predict or guarantee returns. Check the original filings, business fundamentals, and valuation before interpreting the activity.",
      },
      {
        q: "Do option exercises or stock grants count toward a cluster?",
        a: "Grants and option exercises do not count. Our filter selects qualifying code-P purchases, which may include private purchases and transactions under a 10b5-1 plan. Check the filing footnotes for context.",
      },
    ],
    body: (
      <>
        <P>
          A <Strong>cluster buy</Strong> is when two or more distinct insiders —
          officers, directors, or 10% owners of the same company — each buy the
          company&apos;s stock through qualifying purchases within a rolling
          detection window. Grouping distinct buyers makes the purchases easier
          to research together. It does not establish their motives, whether
          their decisions were independent, or the stock&apos;s future
          performance.
        </P>
        <H2>Why research clustered purchases?</H2>
        <P>
          A cluster gives you a focused question: why did several insiders buy
          this company&apos;s shares in the same period? Check their roles,
          purchase sizes, ownership details, and the business&apos;s valuation
          rather than treating the activity as a recommendation.
        </P>
        <P>
          For research on differences between routine and opportunistic insider
          trades, see{" "}
          <Ext href="https://www.nber.org/papers/w16454">
            Cohen, Malloy &amp; Pomorski&apos;s &quot;Decoding Inside
            Information&quot;
          </Ext>
          . Historical research does not validate our specific detection window
          or guarantee an outcome for an individual cluster.
        </P>
        <H2>What qualifies (our definition)</H2>
        <UL>
          <li>
            <Strong>Qualifying code-P purchases</Strong> — Form 4 transaction
            code <Mono>P</Mono> covers open-market or private purchases. Grants
            and option exercises do not count; scheduled purchases are not
            independently excluded by our filter. See{" "}
            <A href="/learn/form-4-transaction-codes">
              Form 4 transaction codes
            </A>
            .
          </li>
          <li>
            <Strong>Two or more distinct insiders</Strong> — same person filing
            twice is one insider, not a cluster.
          </li>
          <li>
            <Strong>Within a rolling window</Strong> — close enough in time to
            meet the configured detection rule. The code defaults to 90 days;
            the displayed dates show the included purchases.
          </li>
          <li>
            <Strong>Any company size</Strong> — we track clusters from
            micro-caps to mega-caps. The signal tends to run strongest in
            smaller names; see{" "}
            <A href="/learn/why-small-cap-insider-buying-matters">
              why small-cap insider buying matters
            </A>
            .
          </li>
        </UL>
        <H2>Where to see live cluster buys</H2>
        <P>
          We monitor public Form 4 filings on SEC EDGAR and group qualifying
          purchases after processing. Read our{" "}
          <A href="/methodology">data and detection methodology</A> for the full
          rules and limitations. Browse{" "}
          <A href="/stocks">every stock with a detected cluster buy</A>, see{" "}
          <A href="/insiders">which insiders buy the most</A>, or scan activity{" "}
          <A href="/sectors">by sector</A>.
        </P>
      </>
    ),
  },
  {
    slug: "form-4-transaction-codes",
    title: "SEC Form 4 transaction codes explained",
    seoTitle: "Form 4 Transaction Codes Explained",
    description:
      "Decode SEC Form 4 transaction codes with a complete reference table. Understand purchases, sales, grants, exercises, and the separate acquired/disposed flag.",
    updated: "2026-10-13",
    related: [
      "how-to-read-a-form-4",
      "what-is-open-market-purchase",
      "what-is-a-10b5-1-plan",
    ],
    faq: [
      {
        q: "What does Form 4 code P mean?",
        a: "P identifies an open-market or private purchase. It does not by itself establish personal cash funding, discretionary timing, or a purchase on a stock exchange. Check ownership, plan disclosures, and footnotes.",
      },
      {
        q: "Is the acquired/disposed A the same as transaction code A?",
        a: "No. In the acquired/disposed column, A means securities were acquired. In the transaction-code column, A describes a grant, award, or other acquisition under Rule 16b-3(d).",
      },
      {
        q: "Does an option exercise count as an open-market purchase?",
        a: "No. Code M identifies an exercise or conversion under Rule 16b-3. It may be accompanied by acquired shares and a separate sale, so read both tables and the footnotes.",
      },
    ],
    body: (
      <>
        <P>
          <Strong>
            Form 4 transaction codes describe how securities changed hands.
          </Strong>{" "}
          P means a purchase, S a sale, A a grant or award, and M an exercise or
          conversion. These codes are separate from the acquired/disposed flag
          and the direct/indirect ownership column.
        </P>
        <H2>Complete transaction-code reference</H2>
        <P>
          This table follows Instruction 8 of the{" "}
          <Ext href="https://www.sec.gov/files/form4.pdf">
            SEC Form 4 instructions
          </Ext>
          . Interpretation depends on the transaction and its footnotes.
        </P>
        <CodeTable
          rows={[
            [
              "P",
              "Purchase, on-market or private",
              "Check price, ownership, and whether it was scheduled",
            ],
            [
              "S",
              "Sale, on-market or private",
              "The code alone does not explain why the holder sold",
            ],
            [
              "V",
              "Reported voluntarily before required",
              "A timing designation, not a purchase signal",
            ],
            [
              "A",
              "Grant, award, or other Rule 16b-3(d) acquisition",
              "Distinguish an award from a market purchase",
            ],
            [
              "D",
              "Transfer of issuer securities back to the issuer",
              "Read the transaction terms",
            ],
            [
              "F",
              "Securities used for exercise costs or taxes",
              "Can involve delivery or withholding of shares",
            ],
            [
              "I",
              "Discretionary transaction under Rule 16b-3(f)",
              "Read the plan and transaction details",
            ],
            [
              "M",
              "Rule 16b-3 exercise or conversion",
              "An acquisition can result without a market purchase",
            ],
            [
              "C",
              "Derivative conversion",
              "Compare the derivative and underlying security rows",
            ],
            [
              "E",
              "Short derivative position expires",
              "Not an open-market stock purchase",
            ],
            [
              "H",
              "Long derivative expires or is canceled for value",
              "Check what value was received",
            ],
            [
              "O",
              "Out-of-the-money derivative exercise",
              "Review exercise terms",
            ],
            [
              "X",
              "In-the-money or at-the-money derivative exercise",
              "Review exercise terms",
            ],
            ["G", "Gift", "A transfer, not a purchase for cash"],
            [
              "L",
              "Small acquisition under Rule 16a-6",
              "Check reporting exceptions",
            ],
            [
              "W",
              "Inheritance or transfer by will",
              "Not an open-market stock purchase",
            ],
            [
              "Z",
              "Transfer into or out of a voting trust",
              "Check beneficial ownership",
            ],
            [
              "J",
              "Other acquisition or disposition",
              "The explanation of responses defines the event",
            ],
            [
              "K",
              "Equity swap or similar instrument",
              "May accompany another code, such as P/K or S/K",
            ],
            [
              "U",
              "Shares tendered in a change of control",
              "Check the tender terms",
            ],
          ]}
        />
        <H2>Code P does not prove discretionary buying</H2>
        <P>
          Purchase code P includes private transactions and may include trades
          under a <A href="/learn/what-is-a-10b5-1-plan">10b5-1 plan</A>. The
          checkbox and footnotes provide that context. Joint reporting owners
          can also describe the same economic purchase; adding every
          owner&apos;s reported value can double-count it.
        </P>
        <H2>A real exercise-and-sale example</H2>
        <P>
          In{" "}
          <Ext href="https://www.sec.gov/Archives/edgar/data/1082554/000123142725000004/xslF345X05/primarydocument.xml">
            Christopher Patusky&apos;s UTHR filing for December 15, 2025
          </Ext>
          , Table I records 1,000 shares acquired with code M and 1,000 disposed
          with code S. The acquired flag does not turn the M transaction into a
          code-P purchase.
        </P>
        <H2>How InsiderClusters uses the codes</H2>
        <P>
          Our detector uses qualifying non-derivative code-P records. It does
          not independently exclude every scheduled or private purchase. Read
          the <A href="/methodology">methodology</A>, follow the{" "}
          <A href="/learn/how-to-read-a-form-4">filing walkthrough</A>, and
          compare the source documents on the{" "}
          <A href="/stocks">insider buying directory</A>.
        </P>
      </>
    ),
  },
  {
    slug: "how-to-read-a-form-4",
    title: "How to read SEC Form 4: a filing walkthrough",
    seoTitle: "How to Read SEC Form 4",
    description:
      "Read SEC Form 4 step by step: identify the owner, decode transactions, compare acquired and disposed shares, and check footnotes with a real filing example.",
    updated: "2026-10-13",
    related: [
      "form-4-transaction-codes",
      "what-is-a-10b5-1-plan",
      "form-4-filing-deadline",
    ],
    faq: [
      {
        q: "What is Table I on SEC Form 4?",
        a: "Table I covers non-derivative securities. Read the date, transaction code, shares, price, acquired/disposed flag, holdings after the transaction, and direct/indirect ownership.",
      },
      {
        q: "Is every acquisition on Form 4 an insider purchase?",
        a: "No. Shares can be acquired through grants, exercises, conversions, or purchases. Use the transaction code rather than the acquired flag alone.",
      },
      {
        q: "Where is a 10b5-1 plan disclosed?",
        a: "Current Form 4 has a plan checkbox, and the plan adoption date is disclosed in the explanation of responses. Older filings may require additional context.",
      },
    ],
    body: (
      <>
        <P>
          <Strong>
            Read Form 4 in this order: owner, security, date, code, shares,
            price, ownership, and footnotes.
          </Strong>{" "}
          It reports changes in beneficial ownership, not just cash purchases.
          The{" "}
          <Ext href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-69">
            SEC investor bulletin
          </Ext>{" "}
          explains how Forms 3, 4, and 5 fit together.
        </P>
        <H2>Identify the company and reporting owner</H2>
        <P>
          The header names the issuer and reporting owner, identifies their
          relationship to the company, and indicates individual or joint filing.
          A reporting owner may be a person, fund, trust, or other entity. The
          CIK identifies the filer; a joint filing can describe shared ownership
          of one transaction.
        </P>
        <H2>Read Table I and Table II together</H2>
        <P>
          Table I covers non-derivative securities; Table II covers derivatives.
          Use the <A href="/learn/form-4-transaction-codes">transaction code</A>{" "}
          to distinguish purchases from grants or exercises. A in the
          acquired/disposed column means acquired and does not mean transaction
          code A.
        </P>
        <H2>Walk through a real filing</H2>
        <P>
          Open{" "}
          <Ext href="https://www.sec.gov/Archives/edgar/data/1082554/000123142725000004/xslF345X05/primarydocument.xml">
            Christopher Patusky&apos;s UTHR Form 4
          </Ext>
          . It lists him as a director and reports activity dated December 15,
          2025.
        </P>
        <UL>
          <li>
            Table I: 1,000 shares acquired with code M at $101.80, then 1,000
            shares disposed with code S.
          </li>
          <li>
            Table II: the corresponding 1,000-share option exercise explains
            where the acquired shares came from.
          </li>
          <li>
            The sale price is $495.9539, and footnote 1 explains that it is a
            weighted average of multiple executions.
          </li>
          <li>
            The form separately shows directly held shares and shares held
            indirectly through a trust.
          </li>
        </UL>
        <P>
          This is an exercise and sale, not a new code-P purchase. Do not infer
          the purpose of the sale from its code alone.
        </P>
        <H2>Check ownership, plans, and footnotes</H2>
        <P>
          Direct and indirect ownership can change the meaning of a transaction.
          Prices may be averages or involve noncash consideration. Check the{" "}
          <A href="/learn/what-is-a-10b5-1-plan">10b5-1 plan</A> designation and
          the explanation of responses. The{" "}
          <Ext href="https://www.sec.gov/files/form4.pdf">
            Form 4 instructions
          </Ext>{" "}
          provide the definitions.
        </P>
        <H2>Keep the transaction date separate from the filing date</H2>
        <P>
          A trade generally becomes public after it occurs, and late filings can
          report older transactions. Read the{" "}
          <A href="/learn/form-4-filing-deadline">filing-deadline guide</A>. On
          our <A href="/stocks">stock research pages</A>, follow the original
          filing links to verify the data and context.
        </P>
      </>
    ),
  },
  {
    slug: "what-is-a-10b5-1-plan",
    title: "What is a Rule 10b5-1 trading plan?",
    seoTitle: "10b5-1 Plans: Rules & Form 4 Disclosures",
    description:
      "Understand Rule 10b5-1 trading plans, cooling-off periods, and Form 4 disclosures. Learn how scheduled trades differ from current discretionary purchases.",
    updated: "2026-10-13",
    related: [
      "how-to-read-a-form-4",
      "form-4-transaction-codes",
      "form-4-filing-deadline",
    ],
    faq: [
      {
        q: "What is a 10b5-1 plan?",
        a: "It is a prearranged contract, instruction, or trading plan that can provide an affirmative defense to insider-trading liability if the rule's conditions are met. It is not automatic immunity.",
      },
      {
        q: "How can I identify a plan trade on Form 4?",
        a: "Current Form 4 has a checkbox for transactions under arrangements intended to satisfy Rule 10b5-1(c). The explanation of responses includes the adoption date.",
      },
      {
        q: "Does InsiderClusters exclude all 10b5-1 purchases?",
        a: "No. Our code-P purchase filter does not independently exclude every plan transaction. Check the source filing's plan disclosure before interpreting a cluster.",
      },
    ],
    body: (
      <>
        <P>
          <Strong>
            A Rule 10b5-1 plan arranges trades before they take place.
          </Strong>{" "}
          It can provide an affirmative defense to insider-trading liability
          when its conditions are satisfied, including adoption without
          awareness of material nonpublic information. The arrangement can set
          trading terms or delegate decisions within the rule&apos;s limits.
        </P>
        <H2>What the rules require</H2>
        <P>
          The{" "}
          <Ext href="https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/insider-trading-arrangements-and-related-disclosures">
            SEC compliance guide
          </Ext>{" "}
          describes good-faith requirements, director and officer
          certifications, restrictions on overlapping arrangements, and limits
          on single-trade plans. Exceptions and the type of participant matter.
        </P>
        <H2>Cooling-off periods before trading</H2>
        <UL>
          <li>
            For directors and officers, trading generally waits until the later
            of 90 days after adoption or certain modifications, or two business
            days after the relevant quarter&apos;s financial results are
            disclosed. The required period is capped at 120 days.
          </li>
          <li>
            For other persons covered by the rule, except the issuer, the
            cooling-off period is 30 days.
          </li>
        </UL>
        <P>
          See the{" "}
          <Ext href="https://www.sec.gov/files/rules/final/2022/33-11138.pdf">
            SEC adopting release
          </Ext>{" "}
          for the precise conditions. A plan designation is not proof that every
          condition was satisfied.
        </P>
        <H2>Find the disclosure on Form 4</H2>
        <P>
          Check the plan checkbox and adoption date in the explanation of
          responses. A purchase can still carry{" "}
          <A href="/learn/form-4-transaction-codes">transaction code P</A> when
          made under a plan. Older filings may have different disclosure
          formats.
        </P>
        <H2>Interpret the timing of a purchase</H2>
        <P>
          A scheduled execution may reflect an earlier decision rather than a
          new assessment of today&apos;s price. Neither a scheduled nor an
          unscheduled purchase establishes a future return. Compare adoption,
          transaction, and filing dates using the{" "}
          <A href="/learn/how-to-read-a-form-4">filing walkthrough</A>.
        </P>
        <H2>How this affects cluster research</H2>
        <P>
          Our detector groups qualifying purchases without independently
          excluding every 10b5-1 trade. Review the{" "}
          <A href="/methodology">detection methodology</A> and source filings in
          the <A href="/stocks">stock directory</A> before interpreting whether
          buyers acted on separate recent decisions.
        </P>
      </>
    ),
  },
  {
    slug: "who-counts-as-an-insider",
    title: "Who counts as a corporate insider?",
    description:
      "Officers, directors, and 10% owners are the 'Section 16 insiders' who must file Form 4s. Here's who's included, and why a CEO's buy means more than a passive fund's.",
    updated: "2026-10-12",
    related: [
      "what-is-a-cluster-buy",
      "how-to-read-a-form-4",
      "form-4-filing-deadline",
    ],
    faq: [
      {
        q: "Who is required to file a Form 4?",
        a: "Section 16 insiders — a company's officers, its directors, and any person or entity beneficially owning more than 10% of a registered class of its stock.",
      },
      {
        q: "Are large shareholders always corporate insiders?",
        a: "Only holders above the 10% threshold are Section 16 insiders, and some are passive funds that crossed the line mechanically and see nothing beyond public filings.",
      },
      {
        q: "Whose insider buying carries the most signal?",
        a: "Executives closest to the numbers — the CEO and CFO — which is why clusters that include a C-suite buyer are tagged as high conviction.",
      },
    ],
    body: (
      <>
        <P>
          &quot;Insider&quot; has a precise legal meaning.{" "}
          <Ext href="https://www.investor.gov/introduction-investing/investing-basics/glossary/forms-3-4-5">
            Section 16 of the Securities Exchange Act
          </Ext>{" "}
          applies to three groups, and only these three must report their trades
          on Form 4:
        </P>
        <UL>
          <li>
            <Strong>Officers</Strong> — the CEO, CFO, COO, presidents, and any
            other policy-making executives the company designates.
          </li>
          <li>
            <Strong>Directors</Strong> — every member of the board, employed by
            the company or not.
          </li>
          <li>
            <Strong>10% owners</Strong> — any person or entity beneficially
            owning more than 10% of a registered class of the company&apos;s
            stock: founders, families, activist funds, strategic holders.
          </li>
        </UL>
        <H2>Not all insiders are equal</H2>
        <P>
          The three groups see very different slices of the business. A CFO sees
          cash, bookings, and the forecast every week. An outside director sees
          board materials a few times a quarter. A passive 10% owner may see
          nothing beyond public filings — some are index funds that crossed the
          threshold mechanically. That&apos;s why role weighting matters: our{" "}
          <Strong>Executive buyer</Strong> tag marks clusters that include at
          least one C-suite or executive-officer buyer, the people closest to
          the numbers.
        </P>
        <H2>The interesting edge: 10% owners who act like operators</H2>
        <P>
          Founder-owners and activist funds file as 10% owners but often know
          the business as deeply as management. When they buy alongside officers
          or directors — three different vantage points agreeing at once —
          that&apos;s the strongest form of the{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster-buy pattern</A>. You
          can see who&apos;s currently buying the most on the{" "}
          <A href="/insiders">insider leaderboard</A>, with every buyer linked
          to their full cross-company history.
        </P>
      </>
    ),
  },
  {
    slug: "form-4-filing-deadline",
    title: "Form 4 filing deadline: the two-business-day rule",
    seoTitle: "Form 4 Filing Deadline: Two Business Days",
    description:
      "Form 4 is generally due within two business days of a reportable transaction. See deadline examples, exceptions, and how filing dates differ from trade dates.",
    updated: "2026-10-13",
    related: [
      "how-to-read-a-form-4",
      "form-3-vs-form-4-vs-form-5",
      "what-is-a-10b5-1-plan",
    ],
    faq: [
      {
        q: "When is Form 4 due?",
        a: "Generally before the end of the second business day following a reportable transaction. A Monday transaction is generally due Wednesday if both following days are business days.",
      },
      {
        q: "Do weekends count toward the deadline?",
        a: "No. The general rule counts business days. A Friday transaction is generally due Tuesday when Monday and Tuesday are business days; holidays can change that timeline.",
      },
      {
        q: "Does a new Form 4 mean the trade happened today?",
        a: "No. Transaction, filing, and detection dates differ. Even timely filings usually follow the trade, and late filings can report substantially older activity.",
      },
    ],
    body: (
      <>
        <P>
          <Strong>
            Form 4 is generally due before the end of the second business day
            after a reportable transaction.
          </Strong>{" "}
          The{" "}
          <Ext href="https://www.sec.gov/files/form4.pdf">
            SEC Form 4 instructions
          </Ext>{" "}
          specify the rule and exceptions, including rules for determining
          execution dates in some transactions.
        </P>
        <H2>Examples of the general deadline</H2>
        <UL>
          <li>
            Monday trade: generally due Wednesday, if Tuesday and Wednesday are
            business days.
          </li>
          <li>
            Friday trade: generally due Tuesday, if Monday and Tuesday are
            business days.
          </li>
          <li>
            If a relevant day is a holiday, check the applicable business-day
            calendar rather than adding two calendar days.
          </li>
        </UL>
        <H2>Exceptions and delayed reports</H2>
        <P>
          Not every change in ownership follows the same reporting treatment.
          Certain exempt acquisitions can be reported later on Form 5; the{" "}
          <Ext href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-69">
            SEC investor bulletin
          </Ext>{" "}
          explains the distinction. A plan trade is not automatically exempt
          from Form 4 reporting.
        </P>
        <P>
          A late filing can report an older transaction. Read the transaction
          date and explanation of responses rather than assuming the filing date
          is the purchase date. An amended filing can correct prior information
          without representing a new trade.
        </P>
        <H2>Three dates to keep separate</H2>
        <UL>
          <li>
            <Strong>Transaction date:</Strong> when the reported purchase or
            other event occurred.
          </li>
          <li>
            <Strong>Filing date:</Strong> when the report was filed with the
            SEC.
          </li>
          <li>
            <Strong>Detection date:</Strong> when our system processed enough
            information to identify a cluster.
          </li>
        </UL>
        <H2>What this means for insider buying alerts</H2>
        <P>
          Alerts follow public filing, processing, and delivery. They do not
          arrive at the moment an insider trades. Compare dates in the{" "}
          <A href="/stocks">insider buying directory</A> and use the{" "}
          <A href="/learn/how-to-read-a-form-4">Form 4 walkthrough</A> to check
          the underlying record. Our <A href="/methodology">methodology</A>{" "}
          describes detection and data limits.
        </P>
      </>
    ),
  },
  {
    slug: "form-3-vs-form-4-vs-form-5",
    seoTitle: "Form 3 vs Form 4 vs Form 5",
    title: "Form 3 vs Form 4 vs Form 5: what's the difference?",
    description:
      "Form 3 declares initial ownership, Form 4 reports trades within two days, Form 5 catches up on exempt transactions annually. Which one carries signal?",
    updated: "2026-07-04",
    related: [
      "how-to-read-a-form-4",
      "form-4-filing-deadline",
      "form-4-transaction-codes",
    ],
    faq: [
      {
        q: "What is the difference between Form 3 and Form 4?",
        a: "Form 3 is a one-time snapshot of holdings filed within 10 days of becoming an insider; Form 4 reports actual trades within two business days of each transaction.",
      },
      {
        q: "What is a Form 5 used for?",
        a: "Form 5 is an annual catch-up, filed within 45 days of fiscal year-end, covering exempt transactions and any trades that should have been reported earlier on a Form 4.",
      },
      {
        q: "Which SEC form matters for tracking insider buying?",
        a: "Form 4 — it is the only one of the three filed fast enough, and with enough transaction detail, to act on.",
      },
    ],
    body: (
      <>
        <P>
          Section 16 insiders file three related forms. They&apos;re often
          confused, but only one of them reports fresh, voluntary trades.
        </P>
        <H2>Form 3 — the starting line</H2>
        <P>
          Filed within 10 days of <em>becoming</em> an insider (new officer, new
          director, crossing 10% ownership). It&apos;s a snapshot of what they
          own on day one — no transactions at all. A Form 3 showing a large
          existing stake is context, not action.
        </P>
        <H2>Form 4 — the one that matters</H2>
        <P>
          Filed within{" "}
          <A href="/learn/form-4-filing-deadline">two business days</A> of any
          change in ownership: buys, sells, grants, exercises, gifts. This is
          the only form fast enough and specific enough to trade on, and the
          open-market purchases inside it (code <Mono>P</Mono> — see{" "}
          <A href="/learn/form-4-transaction-codes">transaction codes</A>) are
          the raw material for{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster-buy detection</A>.
        </P>
        <H2>Form 5 — the annual catch-up</H2>
        <P>
          Filed within 45 days of fiscal year-end for transactions that were
          exempt from Form 4 (small gifts, certain plan transactions) or —
          embarrassingly — trades that should have been on a Form 4 and
          weren&apos;t. By the time something appears on a Form 5 it can be a
          year old. Historical interest only.
        </P>
        <H2>Bottom line</H2>
        <P>
          Watch Form 4s, ignore the rest for signal. We parse every Form 4 as it
          hits EDGAR and surface the ones that matter on{" "}
          <A href="/stocks">the stocks directory</A> and in real-time alerts.
        </P>
      </>
    ),
  },
  {
    slug: "insider-buying-vs-selling",
    seoTitle: "Insider Buying vs Selling",
    title:
      "Insider buying vs insider selling: why the signals aren't symmetric",
    description:
      "Insiders sell for dozens of reasons but buy for one. The research and the intuition behind why purchases predict returns and sales mostly don't.",
    updated: "2026-10-12",
    related: [
      "what-is-a-cluster-buy",
      "what-is-a-10b5-1-plan",
      "form-4-transaction-codes",
    ],
    faq: [
      {
        q: "Is insider selling a bearish signal?",
        a: "Usually not — insiders sell for taxes, diversification, and life expenses, and much of it runs on pre-scheduled 10b5-1 plans, so aggregate sales carry little predictive power.",
      },
      {
        q: "Why is insider buying more predictive than insider selling?",
        a: "An open-market purchase concentrates the insider's wealth further into a stock they are already exposed to, with after-tax personal cash — there is only one plausible motive.",
      },
      {
        q: "What is the strongest form of insider buying?",
        a: "Clustered purchases by distinct insiders can be a useful research lead. Check the detection window and filing context; this pattern does not guarantee returns.",
      },
    ],
    body: (
      <>
        <P>
          The oldest line in insider-filing analysis is still the most important
          one:{" "}
          <Strong>
            insiders sell for many reasons, but they buy for only one
          </Strong>{" "}
          — they expect the stock to go up.
        </P>
        <H2>Why selling is noisy</H2>
        <UL>
          <li>
            Executive pay is mostly equity. Selling is how compensation becomes
            cash — it&apos;s the default, not a decision.
          </li>
          <li>
            Diversification: an executive with 90% of net worth in one stock is
            supposed to sell some, in any rational financial plan.
          </li>
          <li>
            Taxes, houses, tuition, divorce — life events force sales on a
            schedule that has nothing to do with the company&apos;s prospects.
          </li>
          <li>
            Much selling runs on{" "}
            <A href="/learn/what-is-a-10b5-1-plan">10b5-1 autopilot</A>,
            scheduled months in advance.
          </li>
        </UL>
        <H2>Why buying is clean</H2>
        <P>
          An open-market purchase inverts every one of those pressures. The
          insider already has concentrated exposure through options, RSUs, and
          salary tied to the same company — and chooses to concentrate{" "}
          <em>further</em>, with after-tax personal cash. There&apos;s no
          compensation mechanics, no diversification logic, no tax motive. The{" "}
          <Ext href="https://www.nber.org/papers/w16454">academic record</Ext>{" "}
          agrees: purchases carry predictive power for forward returns; sales,
          in aggregate, carry very little.
        </P>
        <H2>And the strongest form of buying</H2>
        <P>
          Several distinct insiders buying can warrant closer research, but the
          filings alone do not prove independent decisions or future returns.
          That&apos;s the{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster-buy pattern</A> — two
          or more insiders buying the same stock within days — and it&apos;s
          strongest in{" "}
          <A href="/learn/why-small-cap-insider-buying-matters">small-caps</A>,
          where the information gap between insiders and the market is widest.
          Browse the live record on <A href="/stocks">the stocks page</A>.
        </P>
      </>
    ),
  },
  {
    slug: "insider-buying-vs-share-buyback",
    seoTitle: "Insider Buying vs Share Buybacks",
    title: "Insider buying vs share buybacks: which signal is stronger?",
    description:
      "Buybacks spend shareholder money; insider buys spend the executive's own. Why personal purchases are the cleaner conviction signal, and what each is good for.",
    updated: "2026-07-04",
    related: [
      "insider-buying-vs-selling",
      "what-is-a-cluster-buy",
      "what-is-open-market-purchase",
    ],
    faq: [
      {
        q: "Are share buybacks a reliable bullish signal?",
        a: "Mixed at best — many buybacks exist to offset stock-compensation dilution or support EPS targets, and announced authorizations often go partly unused.",
      },
      {
        q: "Why is insider buying a cleaner signal than a buyback?",
        a: "An insider buy risks the executive's own after-tax cash, while a buyback spends shareholder money — personal risk is what makes the signal credible.",
      },
      {
        q: "What is the strongest combination of the two?",
        a: "An insider cluster buy occurring during an active repurchase program — personal and corporate conviction pointing in the same direction at once.",
      },
    ],
    body: (
      <>
        <P>
          Both look like &quot;the company thinks its stock is cheap.&quot; They
          are not the same signal, and the difference comes down to whose money
          is at risk.
        </P>
        <H2>Buybacks: corporate money, mixed motives</H2>
        <P>
          A buyback is a board-authorized use of <em>shareholder</em> cash. Some
          buybacks are genuine valuation calls; many exist to offset dilution
          from stock compensation, hit EPS targets that drive bonus formulas, or
          signal without any executive taking personal risk. Announced
          authorizations often go partly unused. An executive can preside over a
          billion-dollar buyback while personally selling every vested share —
          and that combination is common.
        </P>
        <H2>Insider buys: personal money, one motive</H2>
        <P>
          An open-market purchase (Form 4, code <Mono>P</Mono>) is the
          executive&apos;s own after-tax cash adding to an already concentrated
          position. There&apos;s no EPS arithmetic and no dilution management —
          just a view on the price. That&apos;s why{" "}
          <A href="/learn/insider-buying-vs-selling">
            purchases are the asymmetric signal
          </A>{" "}
          in the filing data.
        </P>
        <H2>The best case: both at once</H2>
        <P>
          When a company is buying back stock <em>and</em> multiple insiders are
          buying personally — a{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster buy</A> on top of an
          active repurchase program — corporate and personal conviction are
          pointing the same direction. The cluster is the part we detect
          automatically; see <A href="/stocks">which stocks show one now</A>.
        </P>
      </>
    ),
  },
  {
    slug: "what-is-open-market-purchase",
    seoTitle: "Open-Market Purchases & Form 4 Code P",
    title: "What is an open-market purchase (Form 4 code P)?",
    description:
      "An open-market purchase is an insider buying company stock on the exchange with personal cash — transaction code P on Form 4. Why it's the only routine filing event with real signal.",
    updated: "2026-07-04",
    related: [
      "form-4-transaction-codes",
      "insider-buying-vs-selling",
      "what-is-a-cluster-buy",
    ],
    faq: [
      {
        q: "What code marks an open-market purchase on a Form 4?",
        a: "Transaction code P in Table I of the Form 4 — the insider bought shares at market price with personal cash.",
      },
      {
        q: "Is an option exercise an open-market purchase?",
        a: "No. Exercises are reported under code M and convert compensation the company already awarded; no personal cash buys shares at the market price.",
      },
      {
        q: "What size of insider purchase is meaningful?",
        a: "Purchases that are large relative to the insider's salary and existing stake carry the most signal. InsiderClusters surfaces every open-market purchase, so you can weigh each buy's size in context rather than having a fixed cutoff applied for you.",
      },
    ],
    body: (
      <>
        <P>
          An <Strong>open-market purchase</Strong> is exactly what it sounds
          like: a corporate insider places an order through a broker and buys
          their company&apos;s shares on the exchange, at the market price, with
          their own money. On the Form 4 it appears as transaction code{" "}
          <Mono>P</Mono> in Table I.
        </P>
        <H2>What it is not</H2>
        <UL>
          <li>
            Not a <Strong>grant</Strong> (code <Mono>A</Mono>) — that&apos;s the
            company giving shares as pay.
          </li>
          <li>
            Not an <Strong>option exercise</Strong> (code <Mono>M</Mono>) —
            that&apos;s converting compensation already awarded.
          </li>
          <li>
            Not <Strong>tax withholding</Strong> (code <Mono>F</Mono>) or a{" "}
            <Strong>gift</Strong> (code <Mono>G</Mono>).
          </li>
          <li>
            Sometimes not even a market trade — code <Mono>P</Mono> also covers
            private purchases; the footnotes say which.
          </li>
        </UL>
        <P>
          The full list is in{" "}
          <A href="/learn/form-4-transaction-codes">
            Form 4 transaction codes explained
          </A>
          .
        </P>
        <H2>Reading size and context</H2>
        <P>
          Signal scales with commitment. A $5,000 optics buy after an ugly
          earnings call is noise; a purchase that&apos;s large relative to the
          insider&apos;s salary and existing stake is information. We surface
          every open-market buy so you can weigh size in context, weight C-suite
          buyers over passive holders, and — most importantly — watch for{" "}
          <A href="/learn/what-is-a-cluster-buy">
            multiple insiders buying within the same rolling window
          </A>
          . Every qualifying purchase we&apos;ve parsed is browsable per stock
          on <A href="/stocks">the stocks directory</A> and per person on{" "}
          <A href="/insiders">the insider leaderboard</A>.
        </P>
      </>
    ),
  },
  {
    slug: "why-small-cap-insider-buying-matters",
    seoTitle: "Small-Cap Insider Buying",
    title: "Why insider buying matters most in small-caps",
    description:
      "The information gap between insiders and the market is widest in small and micro-cap stocks — no analyst coverage, thin liquidity, and binary outcomes. Here's the logic and the evidence.",
    updated: "2026-07-04",
    related: [
      "what-is-a-cluster-buy",
      "insider-buying-vs-selling",
      "who-counts-as-an-insider",
    ],
    faq: [
      {
        q: "Why is insider buying a stronger signal in small-cap stocks?",
        a: "The information gap between insiders and the market is widest in small-caps — many smaller companies have little or no analyst coverage, so an insider's edge is largest there.",
      },
      {
        q: "Does InsiderClusters only track small-cap cluster buys?",
        a: "No — we run cluster detection on companies of every size, from micro-caps to mega-caps. The signal simply tends to be strongest in smaller names, for the reasons above.",
      },
      {
        q: "Does insider buying predict returns in large-cap stocks?",
        a: "The effect exists across the market but is much weaker in large-caps, where heavy analyst and quant coverage shrinks the insider's information advantage.",
      },
    ],
    body: (
      <>
        <P>
          Insider purchases predict returns everywhere, but the effect
          concentrates dramatically at the small end of the market. There are
          three structural reasons.
        </P>
        <H2>1. Nobody else is looking</H2>
        <P>
          A mega-cap has dozens of analysts, quant coverage, and satellite
          photos of its parking lots. A $300M company might have zero analysts.
          The insider&apos;s information edge over the marginal buyer is
          therefore enormous — when the CFO of an uncovered micro-cap buys
          $200,000 of stock, they may be the single best-informed participant
          who will trade it that month.
        </P>
        <H2>2. Insider buys are material relative to the float</H2>
        <P>
          $500,000 of insider buying in a $2B company is a rounding error. The
          same purchase in a $150M company with a thin float is real demand —
          and more importantly, a real fraction of the insider&apos;s control of
          the company changing hands at market prices.
        </P>
        <H2>3. Small-cap outcomes are binary enough to know things about</H2>
        <P>
          Development-stage biotechs, single-product industrials, one-customer
          suppliers: their futures hinge on discrete events that insiders watch
          from the inside. That&apos;s also why we treat clustered buying —
          several insiders acting in the same window — as the qualifying
          pattern: it separates shared, firm-level conviction from one
          person&apos;s guess. See{" "}
          <A href="/learn/what-is-a-cluster-buy">what makes a cluster buy</A>.
        </P>
        <H2>How we track it</H2>
        <P>
          We run cluster detection across companies of{" "}
          <Strong>every size</Strong> — micro-caps to mega-caps, with no
          market-cap ceiling and no minimum purchase size. The signal runs
          strongest in the smaller names above, but you see every cluster either
          way. The full record is browsable <A href="/stocks">by stock</A> and{" "}
          <A href="/sectors">by sector</A>.
        </P>
      </>
    ),
  },
  {
    slug: "what-is-sec-edgar",
    seoTitle: "SEC EDGAR & Insider Filings",
    title: "What is SEC EDGAR (and how insider filings get there)?",
    description:
      "EDGAR is the SEC's public filing system — every Form 4 appears there within seconds of acceptance. How the pipeline works and how to read filings at the source.",
    updated: "2026-07-04",
    related: [
      "form-4-filing-deadline",
      "how-to-read-a-form-4",
      "form-3-vs-form-4-vs-form-5",
    ],
    faq: [
      {
        q: "Is SEC EDGAR free to use?",
        a: "Yes. Every filing on EDGAR — including all insider Forms 3, 4, and 5 — is publicly readable for free at sec.gov within seconds of acceptance.",
      },
      {
        q: "How quickly do Form 4 filings appear on EDGAR?",
        a: "Essentially instantly — EDGAR publishes accepted filings to its full-text and index feeds within seconds, during filing hours of 6 a.m. to 10 p.m. Eastern.",
      },
      {
        q: "What does EDGAR not do for insider-trading analysis?",
        a: "EDGAR doesn't filter or connect filings — it won't separate open-market buys from compensation noise or detect multiple insiders buying the same stock in the same window.",
      },
    ],
    body: (
      <>
        <P>
          <Strong>EDGAR</Strong> (Electronic Data Gathering, Analysis, and
          Retrieval) is{" "}
          <Ext href="https://www.sec.gov/edgar">
            the SEC&apos;s filing system
          </Ext>
          . Every public-company document — 10-Ks, 8-Ks, prospectuses, and every
          insider Form 3, 4, and 5 — is filed through EDGAR and becomes publicly
          readable within seconds of acceptance, for free.
        </P>
        <H2>How a Form 4 flows through it</H2>
        <UL>
          <li>
            The insider trades; within{" "}
            <A href="/learn/form-4-filing-deadline">two business days</A> their
            counsel files the Form 4 as structured XML.
          </li>
          <li>
            EDGAR accepts filings from 6 a.m. to 10 p.m. Eastern on business
            days and publishes them to its full-text and index feeds essentially
            instantly.
          </li>
          <li>
            Each filing gets an accession number and lives at a permanent URL
            under the company&apos;s CIK — which is why every row on our pages
            can link straight to its source document.
          </li>
        </UL>
        <H2>Reading EDGAR yourself vs. using a layer on top</H2>
        <P>
          Everything we show exists on EDGAR — that&apos;s the point; it&apos;s
          all verifiable. What EDGAR doesn&apos;t do is filter or connect: it
          won&apos;t separate an{" "}
          <A href="/learn/what-is-open-market-purchase">open-market buy</A> from
          routine compensation noise, and it has no concept of two insiders
          buying the same stock in the same week. We poll EDGAR continuously,
          parse each Form 4, keep the meaningful purchases, and detect{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster buys</A> across them —
          with alerts the moment one forms. The result is browsable on{" "}
          <A href="/stocks">stocks</A>, <A href="/insiders">insiders</A>, and{" "}
          <A href="/sectors">sectors</A>.
        </P>
      </>
    ),
  },
];

export function getArticle(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((a) => a.slug === slug);
}
