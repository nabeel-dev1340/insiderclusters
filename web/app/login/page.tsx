import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/site-chrome";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};
const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That sign-in link was invalid. Request a new one below.",
  expired:
    "That sign-in link has expired or was already used. Request a new one below.",
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ??
      "Something went wrong. Please request a new sign-in link.")
    : null;
  return (
    <main id="main-content" tabIndex={-1} className="login-shell">
      <aside className="login-editorial">
        <div>
          <Link href="/" className="text-sm font-semibold tracking-tight">
            InsiderClusters <span aria-hidden>↗</span>
          </Link>
          <h2>
            Research starts
            <br />
            with <em>evidence.</em>
          </h2>
          <p>
            Follow clustered insider purchases. Read the original filings. Build
            your own perspective.
          </p>
        </div>
        <p className="text-xs">Public SEC filings. Independent research.</p>
      </aside>
      <section className="login-panel">
        <div className="mx-auto w-full max-w-sm">
          <Wordmark />
          <span className="eyebrow mt-12">Your research desk</span>
          <h1 className="mt-4 text-4xl">Welcome back.</h1>
          <p className="mt-4 text-sm text-muted">
            Enter your email to receive a secure sign-in link. New here? The
            same link creates your account.
          </p>
          {errorMessage && (
            <p
              role="alert"
              className="mt-5 rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {errorMessage}
            </p>
          )}
          <div className="mt-7">
            <LoginForm next={next} />
          </div>
          <p className="mt-6 text-xs text-muted">
            No password to remember. Every paid plan begins with a 7-day trial;
            a card is required at checkout.
          </p>
          <div className="mt-8 flex justify-between border-t border-border pt-5 text-xs">
            <Link className="text-accent hover:underline" href="/pricing">
              Compare plans ↗
            </Link>
            <Link className="text-muted hover:underline" href="/stocks">
              Explore public data ↗
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
