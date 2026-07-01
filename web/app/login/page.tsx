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
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email and we&apos;ll send you a magic sign-in link. No password needed.
        </p>
        {errorMessage && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </p>
        )}
        <LoginForm next={next} />
      </div>
    </div>
  );
}
