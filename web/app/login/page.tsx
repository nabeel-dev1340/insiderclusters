import Link from "next/link";
import { Wordmark } from "@/components/site-chrome";
import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That sign-in link was invalid. Request a new one below.",
  expired: "That sign-in link has expired or was already used. Request a new one below.",
};

// Server component: reads the error from the query string (set by /auth/verify
// on failure) and passes it to the client form. In Next 16, `searchParams` is a
// promise.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Something went wrong." : null;

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-16 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Wordmark />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            Enter your email and we&apos;ll send you a magic sign-in link. No
            password needed.
          </p>

          {errorMessage && (
            <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {errorMessage}
            </p>
          )}

          <div className="mt-6">
            <LoginForm next={next} />
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <span className="text-foreground">
            Signing in creates your free account.
          </span>{" "}
          <Link href="/pricing" className="text-accent hover:underline">
            See plans
          </Link>
        </p>
      </div>
    </div>
  );
}
