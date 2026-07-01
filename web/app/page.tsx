import Link from "next/link";

// Minimal placeholder landing page. The real marketing landing (Feature 3.1)
// is built in Phase 3.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
        Insider cluster-buy alerts
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Real-time alerts when multiple insiders buy the same small-cap stock.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Sign in
      </Link>
    </div>
  );
}
