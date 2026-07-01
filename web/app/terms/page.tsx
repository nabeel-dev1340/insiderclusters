import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRO_PRICE_MONTHLY } from "@/components/pricing";

const SUPPORT_EMAIL = "support@beelodev.com";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of InsiderClusters, including the informational nature of the service and the absence of investment advice.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate="July 1, 2026"
      intro="These Terms of Service (the “Terms”) govern your access to and use of the InsiderClusters website and services (the “Service”). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service."
    >
      <section>
        <h2>1. What InsiderClusters does</h2>
        <p>
          InsiderClusters monitors public SEC Form 4 filings, detects when
          multiple company insiders purchase the same stock within a short
          window (a “cluster buy”), and presents that information through a
          dashboard and optional alerts. All underlying data originates from
          public filings on SEC EDGAR.
        </p>
      </section>

      <section>
        <h2>2. Not investment advice</h2>
        <p>
          The Service is provided for informational and educational purposes
          only. Nothing on InsiderClusters is investment, financial, legal, or
          tax advice, and nothing constitutes a recommendation or solicitation
          to buy, sell, or hold any security. Insider purchases are one data
          point among many and do not predict future performance. You are solely
          responsible for your own investment decisions and should consult a
          licensed professional where appropriate.
        </p>
      </section>

      <section>
        <h2>3. Eligibility and accounts</h2>
        <p>
          You must be at least 18 years old to use the Service. We use passwordless
          “magic link” sign-in: you provide an email address and we send a
          single-use link to authenticate you. You are responsible for
          maintaining access to your email account and for all activity that
          occurs under your account. Notify us promptly at {SUPPORT_EMAIL} if you
          suspect unauthorized use.
        </p>
      </section>

      <section>
        <h2>4. Plans and billing</h2>
        <p>
          The Service offers a free plan with a delayed, limited feed and a paid
          “Pro” plan at ${PRO_PRICE_MONTHLY} per month that provides real-time
          access and additional alert channels. Paid subscriptions renew
          automatically each billing period until cancelled. You may cancel at
          any time, and cancellation takes effect at the end of the current
          billing period. Fees are stated exclusive of any applicable taxes.
          Where payments are processed by a third-party payment provider, that
          provider’s terms also apply to the transaction.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            scrape, resell, or systematically redistribute the Service’s data or
            content except as expressly permitted;
          </li>
          <li>
            attempt to gain unauthorized access to the Service, other accounts,
            or our infrastructure;
          </li>
          <li>
            interfere with or disrupt the integrity or performance of the
            Service, including via automated request floods; or
          </li>
          <li>use the Service to violate any applicable law or regulation.</li>
        </ul>
      </section>

      <section>
        <h2>6. Data source and accuracy</h2>
        <p>
          We derive clusters from filings published by third parties (primarily
          the SEC) and from market data sources that may be delayed or contain
          errors. We strive for accuracy but do not warrant that the data is
          complete, timely, or error-free. Each cluster links to its source
          filing so you can verify it independently. The Service is provided
          “as is” and “as available.”
        </p>
      </section>

      <section>
        <h2>7. Disclaimers and limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, InsiderClusters disclaims all
          warranties, express or implied, including merchantability, fitness for
          a particular purpose, and non-infringement. We are not liable for any
          trading or investment losses, or for any indirect, incidental, special,
          consequential, or punitive damages arising from your use of the
          Service. Our total aggregate liability for any claim relating to the
          Service will not exceed the greater of the amount you paid us in the
          twelve months preceding the claim or USD 100.
        </p>
      </section>

      <section>
        <h2>8. Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate
          your access if you breach these Terms or if we discontinue the Service.
          Provisions that by their nature should survive termination will
          survive.
        </p>
      </section>

      <section>
        <h2>9. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. When we make material
          changes, we will update the effective date above and, where
          appropriate, notify you. Your continued use of the Service after a
          change takes effect constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about these Terms? Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
