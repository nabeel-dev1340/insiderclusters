import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

const SUPPORT_EMAIL = "support@beelodev.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How InsiderClusters collects, uses, and protects your data. We collect the minimum needed to run the Service — primarily your email address.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate="July 1, 2026"
      intro="This Privacy Policy explains what information InsiderClusters collects, why we collect it, and the choices you have. We collect the minimum necessary to operate the Service, and we do not sell your personal information."
    >
      <section>
        <h2>1. Information we collect</h2>
        <p>We collect only what we need to provide the Service:</p>
        <ul>
          <li>
            <strong>Account data:</strong> your email address, which you provide
            to sign in via a magic link, plus your plan and alert preferences.
          </li>
          <li>
            <strong>Authentication data:</strong> single-use sign-in tokens and
            session records used to keep you logged in. Tokens are stored hashed,
            never in plain text.
          </li>
          <li>
            <strong>Billing data:</strong> if you subscribe to Pro, our payment
            processor handles your card details. We never see or store full card
            numbers; we retain only a customer/subscription reference and status.
          </li>
          <li>
            <strong>Usage and technical data:</strong> basic server logs and, if
            enabled, privacy-respecting product analytics used to keep the
            Service reliable and to understand aggregate usage.
          </li>
        </ul>
        <p>
          The insider-trading data shown in the Service comes from public SEC
          filings and is not personal information about you.
        </p>
      </section>

      <section>
        <h2>2. How we use information</h2>
        <ul>
          <li>to authenticate you and operate your account;</li>
          <li>to send the alerts and emails you have opted into;</li>
          <li>to process and manage paid subscriptions;</li>
          <li>to secure, maintain, and improve the Service; and</li>
          <li>to comply with legal obligations.</li>
        </ul>
        <p>
          We rely on your consent (for optional alerts), the performance of our
          contract with you (to provide the Service), and our legitimate
          interests (to keep the Service secure and functional) as the bases for
          this processing.
        </p>
      </section>

      <section>
        <h2>3. Cookies</h2>
        <p>
          We use a single essential, httpOnly session cookie to keep you signed
          in. It is not used for advertising or cross-site tracking. Any
          analytics we run is configured to minimize personal data. You can
          block cookies in your browser, but the sign-in flow will not work
          without the session cookie.
        </p>
      </section>

      <section>
        <h2>4. How we share information</h2>
        <p>
          We do not sell your personal information. We share it only with service
          providers who process it on our behalf under appropriate safeguards,
          such as our hosting/database provider, our email delivery provider, our
          payment processor, and (if enabled) our analytics provider. We may also
          disclose information where required by law or to protect our rights and
          the safety of others.
        </p>
      </section>

      <section>
        <h2>5. Data retention</h2>
        <p>
          We keep account data for as long as your account is active. Sign-in
          tokens expire quickly and are purged after use. If you close your
          account, we delete or anonymize your personal data within a reasonable
          period, except where we must retain it to meet legal, accounting, or
          security obligations.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <p>
          Depending on where you live, you may have the right to access, correct,
          export, or delete your personal data, and to object to or restrict
          certain processing. You can exercise these rights — or delete your
          account entirely — by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. You can also
          unsubscribe from alert emails at any time from your settings or via the
          link in each email.
        </p>
      </section>

      <section>
        <h2>7. Security</h2>
        <p>
          We protect data in transit with TLS, store authentication tokens
          hashed, and limit access to production systems. No method of storage or
          transmission is perfectly secure, but we work to protect your
          information and to respond promptly to any incident.
        </p>
      </section>

      <section>
        <h2>8. Children</h2>
        <p>
          The Service is not directed to anyone under 18, and we do not knowingly
          collect personal information from children. If you believe a child has
          provided us data, contact us and we will delete it.
        </p>
      </section>

      <section>
        <h2>9. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will revise the
          effective date above and, for material changes, provide additional
          notice where appropriate.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions or requests about your privacy? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
