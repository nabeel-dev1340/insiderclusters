import type { ReactNode } from "react";
import Link from "next/link";

// Glossary / education layer (SEO plan P4). Hand-written articles that build
// topical authority around the programmatic pages and give AI search something
// citable. Each article links into the live data surfaces (/stocks, /insiders,
// /sectors) so crawlers and readers both flow from explanation to evidence.

export interface LearnArticle {
  slug: string;
  title: string; // H1 / <title>
  description: string; // meta description
  /** Published/updated date shown on the page and in Article schema (ISO). */
  updated: string;
  related: string[]; // slugs
  body: ReactNode;
}

// --- shared typography helpers (keep articles visually identical) ----------

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 leading-relaxed text-muted">{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-muted">{children}</ul>;
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

function CodeTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Meaning</th>
              <th className="px-4 py-3 font-medium">Signal value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([code, meaning, signal]) => (
              <tr key={code} className="bg-surface">
                <td className="px-4 py-3 font-mono font-semibold">{code}</td>
                <td className="px-4 py-3 text-muted">{meaning}</td>
                <td className="px-4 py-3 text-muted">{signal}</td>
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
      "A cluster buy is two or more corporate insiders buying their own company's stock on the open market within days of each other. Here's why it's the strongest insider signal — and how to track it.",
    updated: "2026-07-03",
    related: ["insider-buying-vs-selling", "who-counts-as-an-insider", "why-small-cap-insider-buying-matters"],
    body: (
      <>
        <P>
          A <Strong>cluster buy</Strong> is when two or more distinct insiders —
          officers, directors, or 10% owners of the same company — each buy the
          company's stock on the open market within a short window (we use 15
          days). One insider buying can mean many things. Several insiders
          reaching the same conclusion independently, at the same time, with
          their own money, is a much harder signal to explain away.
        </P>
        <H2>Why clusters beat single buys</H2>
        <P>
          The academic literature on insider trading keeps landing on the same
          two findings: purchases predict returns better than sales predict
          declines, and <Strong>consensus</Strong> purchases — multiple insiders
          buying together — outperform lone purchases. A single director's buy
          might be portfolio rebalancing, an optics purchase after a bad
          quarter, or a scheduled accumulation. When the CFO, a director, and a
          10% owner all step in during the same two weeks, each of them is
          making an independent judgment from a different vantage point inside
          the same business.
        </P>
        <H2>What qualifies (our definition)</H2>
        <UL>
          <li>
            <Strong>Open-market purchases only</Strong> — Form 4 transaction
            code <Mono>P</Mono>. Grants, option exercises, and 10b5-1 scheduled
            buys don't count. See{" "}
            <A href="/learn/form-4-transaction-codes">Form 4 transaction codes</A>.
          </li>
          <li>
            <Strong>Two or more distinct insiders</Strong> — same person filing
            twice is one insider, not a cluster.
          </li>
          <li>
            <Strong>Within a rolling 15-day window</Strong> — close enough in
            time that the buys reflect the same information environment.
          </li>
          <li>
            <Strong>Meaningful size</Strong> — we require at least $100,000 per
            purchase, which filters out token "confidence" buys.
          </li>
          <li>
            <Strong>Small-caps</Strong> — companies under a $2B market cap,
            where the information gap between insiders and the market is
            widest. See{" "}
            <A href="/learn/why-small-cap-insider-buying-matters">
              why small-cap insider buying matters
            </A>.
          </li>
        </UL>
        <H2>Where to see live cluster buys</H2>
        <P>
          We parse every Form 4 as it hits SEC EDGAR and detect clusters
          continuously. Browse <A href="/stocks">every stock with a detected
          cluster buy</A>, see <A href="/insiders">which insiders buy the
          most</A>, or scan activity <A href="/sectors">by sector</A>.
        </P>
      </>
    ),
  },
  {
    slug: "form-4-transaction-codes",
    title: "Form 4 transaction codes explained (P, S, A, M, F, G…)",
    description:
      "Every SEC Form 4 transaction carries a one-letter code. P and S are the ones that matter for signal — here's the full table and what each code actually means.",
    updated: "2026-07-03",
    related: ["how-to-read-a-form-4", "what-is-open-market-purchase", "form-3-vs-form-4-vs-form-5"],
    body: (
      <>
        <P>
          Every transaction reported on a Form 4 carries a single-letter code
          describing <em>how</em> the insider acquired or disposed of the
          shares. Most codes describe administrative events — compensation,
          taxes, transfers. Only a couple describe an insider making a real
          market decision with real money, which is why filtering by code is
          the first step in any insider-trading analysis.
        </P>
        <H2>The codes that matter</H2>
        <CodeTable
          rows={[
            ["P", "Open-market or private purchase", "The strongest code — insider chose to spend cash on the stock"],
            ["S", "Open-market or private sale", "Weak negative — insiders sell for taxes, diversification, houses"],
            ["A", "Grant or award from the company", "None — it's compensation, not a decision"],
            ["M", "Option or derivative exercise", "None by itself — often paired with a same-day S"],
            ["F", "Shares withheld to pay tax on vesting", "None — automatic, not discretionary"],
            ["G", "Bona fide gift", "None — estate planning, charity"],
            ["C", "Conversion of a derivative security", "None — mechanical"],
            ["D", "Disposition back to the company", "None — usually plan-related"],
            ["X", "Exercise of in-the-money options at expiry", "None — forced by the calendar"],
            ["J", "Other (described in a footnote)", "Read the footnote — occasionally interesting"],
          ]}
        />
        <H2>Why we only track code P</H2>
        <P>
          A code-<Mono>P</Mono> purchase is the only routine Form 4 event where
          an insider voluntarily converts personal cash into more exposure to
          their own company. Codes <Mono>A</Mono>, <Mono>M</Mono>, and{" "}
          <Mono>F</Mono> dominate filing volume but carry no intent at all —
          counting them as "insider buying" is the most common mistake in
          DIY Form 4 analysis. Even <Mono>S</Mono> sales are weakly informative
          at best; see{" "}
          <A href="/learn/insider-buying-vs-selling">
            why buying and selling aren't symmetric signals
          </A>.
        </P>
        <P>
          When two or more insiders file code-<Mono>P</Mono> purchases in the
          same stock within days, that's a{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster buy</A> — the pattern
          this site tracks in real time across <A href="/stocks">every
          small-cap with detected activity</A>.
        </P>
      </>
    ),
  },
  {
    slug: "how-to-read-a-form-4",
    title: "How to read a Form 4 filing",
    description:
      "A walkthrough of the SEC Form 4: the reporting owner, Table I vs Table II, transaction codes, prices, and footnotes — and the traps that mislead first-time readers.",
    updated: "2026-07-03",
    related: ["form-4-transaction-codes", "form-3-vs-form-4-vs-form-5", "form-4-filing-deadline"],
    body: (
      <>
        <P>
          A Form 4 is the document a corporate insider files with the SEC when
          their ownership of company stock changes. It's short — one page of
          structured tables — but the structure trips up first-time readers.
          Here's the map.
        </P>
        <H2>The header: who and where</H2>
        <P>
          The top of the form identifies the <Strong>issuer</Strong> (the
          company and its ticker) and the <Strong>reporting owner</Strong> (the
          insider), including the relationship: director, officer (with title),
          10% owner, or other. One filing can have multiple reporting owners —
          a fund and its manager often file jointly. Each person also has a
          CIK, the SEC's permanent identifier, which is how we{" "}
          <A href="/insiders">track an insider's history across companies</A>.
        </P>
        <H2>Table I: non-derivative transactions</H2>
        <P>
          This is the table that matters. Each row shows the security, the
          date, a one-letter{" "}
          <A href="/learn/form-4-transaction-codes">transaction code</A>, the
          number of shares, the price, and whether shares were acquired
          (<Mono>A</Mono>) or disposed of (<Mono>D</Mono>). The last column
          shows shares owned after the transaction — useful for judging how big
          the trade is relative to the insider's existing stake.
        </P>
        <H2>Table II: derivative transactions</H2>
        <P>
          Options, warrants, RSUs, convertible notes. Most rows here are
          compensation mechanics. The classic trap: an option exercise shows up
          in Table II (code <Mono>M</Mono>) alongside a Table I acquisition —
          it looks like buying, but no market purchase happened, and it's
          usually followed by a same-day sale of the exercised shares.
        </P>
        <H2>Footnotes: where the story hides</H2>
        <P>
          Weighted-average price disclosures, 10b5-1 plan designations, trust
          and family-holding explanations all live in the footnotes. A purchase
          made under a{" "}
          <A href="/learn/what-is-a-10b5-1-plan">pre-arranged 10b5-1 plan</A>{" "}
          was scheduled months earlier and carries far less signal than a
          discretionary open-market buy — the footnote is the only place
          that distinction appears.
        </P>
        <H2>Or skip the parsing</H2>
        <P>
          We parse every Form 4 as it hits EDGAR, filter to meaningful
          open-market purchases, and flag when{" "}
          <A href="/learn/what-is-a-cluster-buy">multiple insiders buy the
          same stock at once</A>. Every number links back to the original
          filing.
        </P>
      </>
    ),
  },
  {
    slug: "what-is-a-10b5-1-plan",
    title: "What is a 10b5-1 trading plan?",
    description:
      "10b5-1 plans let insiders schedule trades in advance to avoid insider-trading liability. Here's how they work and why plan trades carry less signal than discretionary buys.",
    updated: "2026-07-03",
    related: ["how-to-read-a-form-4", "insider-buying-vs-selling", "form-4-filing-deadline"],
    body: (
      <>
        <P>
          A <Strong>Rule 10b5-1 plan</Strong> is a written trading schedule an
          insider adopts while they (supposedly) hold no material non-public
          information. Once the plan is in place, a broker executes the trades
          automatically — so many shares on such dates, or at such prices —
          and the insider gets an affirmative defense against insider-trading
          charges even if the trades later coincide with big news.
        </P>
        <H2>The 2023 tightening</H2>
        <P>
          After research showed plan trades beating the market suspiciously
          often, the SEC tightened Rule 10b5-1 in 2023: a mandatory cooling-off
          period before the first trade (90+ days for officers and directors),
          a ban on overlapping plans, limits on single-trade plans, and a
          checkbox on Form 4 itself identifying plan transactions.
        </P>
        <H2>Why it matters for reading Form 4s</H2>
        <UL>
          <li>
            <Strong>Plan sales are near-noise.</Strong> A CEO selling monthly
            through a plan adopted a year ago tells you about their mortgage,
            not their outlook.
          </li>
          <li>
            <Strong>Plan buys are scheduled, not reactive.</Strong> Some
            insiders dollar-cost-average in through plans. Steady conviction,
            but not a fresh judgment about today's price.
          </li>
          <li>
            <Strong>Discretionary open-market buys are the signal.</Strong> An
            unscheduled code-<Mono>P</Mono> purchase is an insider looking at
            the current price and choosing to buy now. That's the transaction
            type we track, and when several insiders do it within days it
            forms a <A href="/learn/what-is-a-cluster-buy">cluster buy</A>.
          </li>
        </UL>
        <P>
          The plan designation lives in the Form 4's checkbox and footnotes —
          one more reason to{" "}
          <A href="/learn/how-to-read-a-form-4">read the whole filing</A>, or
          let us do it and browse the filtered result on{" "}
          <A href="/stocks">the live cluster feed</A>.
        </P>
      </>
    ),
  },
  {
    slug: "who-counts-as-an-insider",
    title: "Who counts as a corporate insider?",
    description:
      "Officers, directors, and 10% owners are the 'Section 16 insiders' who must file Form 4s. Here's who's included, and why a CEO's buy means more than a passive fund's.",
    updated: "2026-07-03",
    related: ["what-is-a-cluster-buy", "how-to-read-a-form-4", "form-4-filing-deadline"],
    body: (
      <>
        <P>
          "Insider" has a precise legal meaning. Section 16 of the Securities
          Exchange Act applies to three groups, and only these three must
          report their trades on Form 4:
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
            owning more than 10% of a registered class of the company's stock:
            founders, families, activist funds, strategic holders.
          </li>
        </UL>
        <H2>Not all insiders are equal</H2>
        <P>
          The three groups see very different slices of the business. A CFO
          sees cash, bookings, and the forecast every week. An outside director
          sees board materials a few times a quarter. A passive 10% owner may
          see nothing beyond public filings — some are index funds that crossed
          the threshold mechanically. That's why role weighting matters: our{" "}
          <Strong>High conviction</Strong> tag marks clusters that include at
          least one C-suite or executive-officer buyer, the people closest to
          the numbers.
        </P>
        <H2>The interesting edge: 10% owners who act like operators</H2>
        <P>
          Founder-owners and activist funds file as 10% owners but often know
          the business as deeply as management. When they buy alongside
          officers or directors — three different vantage points agreeing at
          once — that's the strongest form of the{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster-buy pattern</A>. You
          can see who's currently buying the most on the{" "}
          <A href="/insiders">insider leaderboard</A>, with every buyer linked
          to their full cross-company history.
        </P>
      </>
    ),
  },
  {
    slug: "form-4-filing-deadline",
    title: "How fast must insiders report trades? (Form 4 deadlines)",
    description:
      "Insiders must file a Form 4 within two business days of a trade. Here's the exact rule, the exceptions, and why the deadline makes real-time monitoring possible.",
    updated: "2026-07-03",
    related: ["how-to-read-a-form-4", "form-3-vs-form-4-vs-form-5", "what-is-sec-edgar"],
    body: (
      <>
        <P>
          Since Sarbanes-Oxley in 2002, Section 16 insiders must report a trade
          on Form 4 <Strong>before the end of the second business day</Strong>{" "}
          after the transaction. Trade on Monday, file by Wednesday. Before
          2002 the deadline was the 10th of the following month — up to 40 days
          of lag; today the market learns about insider trades while they're
          still fresh.
        </P>
        <H2>The practical timeline</H2>
        <UL>
          <li>
            <Strong>Day 0:</Strong> the insider trades (the "transaction date"
            on the form).
          </li>
          <li>
            <Strong>Day 1–2:</Strong> counsel or the insider's broker prepares
            and files the Form 4 electronically on{" "}
            <A href="/learn/what-is-sec-edgar">SEC EDGAR</A>. Filings appear
            publicly within seconds of acceptance, and EDGAR accepts them until
            10 p.m. Eastern.
          </li>
          <li>
            <Strong>Late filings happen</Strong> — a small percentage arrive
            days or even months late (the form has a box for explaining). Late
            Form 4s still get processed; it's why historical data occasionally
            shows a "new" buy with an old transaction date.
          </li>
        </UL>
        <H2>Why the two-day rule matters for cluster detection</H2>
        <P>
          Because every insider is on the same two-day clock, a genuine burst
          of buying shows up on EDGAR as a burst of filings. That's what makes{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster buys</A> detectable in
          near-real-time: we poll EDGAR continuously, parse each Form 4 as it
          lands, and alert the moment a second distinct insider buys the same
          small-cap within the window. Paid subscribers get that alert while
          the window is still open — see <A href="/pricing">pricing</A>.
        </P>
      </>
    ),
  },
  {
    slug: "form-3-vs-form-4-vs-form-5",
    title: "Form 3 vs Form 4 vs Form 5: what's the difference?",
    description:
      "Form 3 declares initial ownership, Form 4 reports trades within two days, Form 5 catches up on exempt transactions annually. Which one carries signal?",
    updated: "2026-07-03",
    related: ["how-to-read-a-form-4", "form-4-filing-deadline", "form-4-transaction-codes"],
    body: (
      <>
        <P>
          Section 16 insiders file three related forms. They're often confused,
          but only one of them reports fresh, voluntary trades.
        </P>
        <H2>Form 3 — the starting line</H2>
        <P>
          Filed within 10 days of <em>becoming</em> an insider (new officer,
          new director, crossing 10% ownership). It's a snapshot of what they
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
          weren't. By the time something appears on a Form 5 it can be a year
          old. Historical interest only.
        </P>
        <H2>Bottom line</H2>
        <P>
          Watch Form 4s, ignore the rest for signal. We parse every Form 4 as
          it hits EDGAR and surface the ones that matter on{" "}
          <A href="/stocks">the stocks directory</A> and in real-time alerts.
        </P>
      </>
    ),
  },
  {
    slug: "insider-buying-vs-selling",
    title: "Insider buying vs insider selling: why the signals aren't symmetric",
    description:
      "Insiders sell for dozens of reasons but buy for one. The research and the intuition behind why purchases predict returns and sales mostly don't.",
    updated: "2026-07-03",
    related: ["what-is-a-cluster-buy", "what-is-a-10b5-1-plan", "form-4-transaction-codes"],
    body: (
      <>
        <P>
          The oldest line in insider-filing analysis is still the most
          important one: <Strong>insiders sell for many reasons, but they buy
          for only one</Strong> — they expect the stock to go up.
        </P>
        <H2>Why selling is noisy</H2>
        <UL>
          <li>
            Executive pay is mostly equity. Selling is how compensation becomes
            cash — it's the default, not a decision.
          </li>
          <li>
            Diversification: an executive with 90% of net worth in one stock is
            supposed to sell some, in any rational financial plan.
          </li>
          <li>
            Taxes, houses, tuition, divorce — life events force sales on a
            schedule that has nothing to do with the company's prospects.
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
          <em>further</em>, with after-tax personal cash. There's no
          compensation mechanics, no diversification logic, no tax motive. The
          academic record agrees: purchases carry predictive power for
          forward returns; sales, in aggregate, carry very little.
        </P>
        <H2>And the strongest form of buying</H2>
        <P>
          If one buy is signal, several independent buys are confirmation.
          That's the{" "}
          <A href="/learn/what-is-a-cluster-buy">cluster-buy pattern</A> — two
          or more insiders buying the same stock within days — and it's
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
    title: "Insider buying vs share buybacks: which signal is stronger?",
    description:
      "Buybacks spend shareholder money; insider buys spend the executive's own. Why personal purchases are the cleaner conviction signal, and what each is good for.",
    updated: "2026-07-03",
    related: ["insider-buying-vs-selling", "what-is-a-cluster-buy", "what-is-open-market-purchase"],
    body: (
      <>
        <P>
          Both look like "the company thinks its stock is cheap." They are not
          the same signal, and the difference comes down to whose money is at
          risk.
        </P>
        <H2>Buybacks: corporate money, mixed motives</H2>
        <P>
          A buyback is a board-authorized use of <em>shareholder</em> cash.
          Some buybacks are genuine valuation calls; many exist to offset
          dilution from stock compensation, hit EPS targets that drive bonus
          formulas, or signal without any executive taking personal risk.
          Announced authorizations often go partly unused. An executive can
          preside over a billion-dollar buyback while personally selling every
          vested share — and that combination is common.
        </P>
        <H2>Insider buys: personal money, one motive</H2>
        <P>
          An open-market purchase (Form 4, code <Mono>P</Mono>) is the
          executive's own after-tax cash adding to an already concentrated
          position. There's no EPS arithmetic and no dilution management —
          just a view on the price. That's why{" "}
          <A href="/learn/insider-buying-vs-selling">purchases are the
          asymmetric signal</A> in the filing data.
        </P>
        <H2>The best case: both at once</H2>
        <P>
          When a company is buying back stock <em>and</em> multiple insiders
          are buying personally — a{" "}
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
    title: "What is an open-market purchase (Form 4 code P)?",
    description:
      "An open-market purchase is an insider buying company stock on the exchange with personal cash — transaction code P on Form 4. Why it's the only routine filing event with real signal.",
    updated: "2026-07-03",
    related: ["form-4-transaction-codes", "insider-buying-vs-selling", "what-is-a-cluster-buy"],
    body: (
      <>
        <P>
          An <Strong>open-market purchase</Strong> is exactly what it sounds
          like: a corporate insider places an order through a broker and buys
          their company's shares on the exchange, at the market price, with
          their own money. On the Form 4 it appears as transaction code{" "}
          <Mono>P</Mono> in Table I.
        </P>
        <H2>What it is not</H2>
        <UL>
          <li>
            Not a <Strong>grant</Strong> (code <Mono>A</Mono>) — that's the
            company giving shares as pay.
          </li>
          <li>
            Not an <Strong>option exercise</Strong> (code <Mono>M</Mono>) —
            that's converting compensation already awarded.
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
          <A href="/learn/form-4-transaction-codes">Form 4 transaction codes
          explained</A>.
        </P>
        <H2>Reading size and context</H2>
        <P>
          Signal scales with commitment. A $5,000 optics buy after an ugly
          earnings call is noise; a purchase that's large relative to the
          insider's salary and existing stake is information. We apply a
          $100,000 minimum, weight C-suite buyers over passive holders, and —
          most importantly — watch for{" "}
          <A href="/learn/what-is-a-cluster-buy">multiple insiders buying
          within the same 15-day window</A>. Every qualifying purchase we've
          parsed is browsable per stock on{" "}
          <A href="/stocks">the stocks directory</A> and per person on{" "}
          <A href="/insiders">the insider leaderboard</A>.
        </P>
      </>
    ),
  },
  {
    slug: "why-small-cap-insider-buying-matters",
    title: "Why insider buying matters most in small-caps",
    description:
      "The information gap between insiders and the market is widest in small and micro-cap stocks — no analyst coverage, thin liquidity, and binary outcomes. Here's the logic and the evidence.",
    updated: "2026-07-03",
    related: ["what-is-a-cluster-buy", "insider-buying-vs-selling", "who-counts-as-an-insider"],
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
          The insider's information edge over the marginal buyer is therefore
          enormous — when the CFO of an uncovered micro-cap buys $200,000 of
          stock, they may be the single best-informed participant who will
          trade it that month.
        </P>
        <H2>2. Insider buys are material relative to the float</H2>
        <P>
          $500,000 of insider buying in a $2B company is a rounding error. The
          same purchase in a $150M company with a thin float is real demand —
          and more importantly, a real fraction of the insider's control of
          the company changing hands at market prices.
        </P>
        <H2>3. Small-cap outcomes are binary enough to know things about</H2>
        <P>
          Development-stage biotechs, single-product industrials,
          one-customer suppliers: their futures hinge on discrete events that
          insiders watch from the inside. That's also why we treat clustered
          buying — several insiders acting in the same window — as the
          qualifying pattern: it separates shared, firm-level conviction from
          one person's guess. See{" "}
          <A href="/learn/what-is-a-cluster-buy">what makes a cluster buy</A>.
        </P>
        <H2>Our filter</H2>
        <P>
          We only run cluster detection on companies under a{" "}
          <Strong>$2B market cap</Strong>, with a $100,000 minimum per
          purchase. The result — every small-cap cluster since our records
          begin — is browsable <A href="/stocks">by stock</A> and{" "}
          <A href="/sectors">by sector</A>.
        </P>
      </>
    ),
  },
  {
    slug: "what-is-sec-edgar",
    title: "What is SEC EDGAR (and how insider filings get there)?",
    description:
      "EDGAR is the SEC's public filing system — every Form 4 appears there within seconds of acceptance. How the pipeline works and how to read filings at the source.",
    updated: "2026-07-03",
    related: ["form-4-filing-deadline", "how-to-read-a-form-4", "form-3-vs-form-4-vs-form-5"],
    body: (
      <>
        <P>
          <Strong>EDGAR</Strong> (Electronic Data Gathering, Analysis, and
          Retrieval) is the SEC's filing system. Every public-company document
          — 10-Ks, 8-Ks, prospectuses, and every insider Form 3, 4, and 5 —
          is filed through EDGAR and becomes publicly readable within seconds
          of acceptance, for free.
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
            days and publishes them to its full-text and index feeds
            essentially instantly.
          </li>
          <li>
            Each filing gets an accession number and lives at a permanent URL
            under the company's CIK — which is why every row on our pages can
            link straight to its source document.
          </li>
        </UL>
        <H2>Reading EDGAR yourself vs. using a layer on top</H2>
        <P>
          Everything we show exists on EDGAR — that's the point; it's all
          verifiable. What EDGAR doesn't do is filter or connect: it won't
          separate an{" "}
          <A href="/learn/what-is-open-market-purchase">open-market buy</A>{" "}
          from routine compensation noise, and it has no concept of two
          insiders buying the same stock in the same week. We poll EDGAR
          continuously, parse each Form 4, keep the meaningful purchases, and
          detect <A href="/learn/what-is-a-cluster-buy">cluster buys</A> across
          them — with alerts the moment one forms. The result is browsable on{" "}
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
