"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  connectTelegram,
  setTelegramAlerts,
  disconnectTelegram,
} from "@/app/dashboard/settings/actions";

export function TelegramConnect({
  linked,
  alertsEnabled,
}: {
  linked: boolean;
  alertsEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(alertsEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      try {
        const url = await connectTelegram();
        // Open the bot in a new tab; the webhook links the chat on /start.
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        setError("Couldn't start linking. Try again.");
      }
    });
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    startTransition(async () => {
      try {
        await setTelegramAlerts(next);
      } catch {
        setEnabled(!next); // revert on failure
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      try {
        await disconnectTelegram();
        router.refresh();
      } catch {
        setError("Couldn't disconnect. Try again.");
      }
    });
  }

  if (!linked) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={handleConnect}
          disabled={pending}
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          <TelegramIcon />
          Connect Telegram
        </button>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-xs text-muted hover:text-foreground"
        >
          Already connected? Refresh
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={pending}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60",
          enabled ? "bg-accent" : "bg-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={pending}
        className="text-xs text-muted hover:text-foreground disabled:opacity-60"
      >
        Disconnect
      </button>
    </div>
  );
}

function TelegramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.72 18.9 19.06c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.73 8.62-7.79c.37-.33-.08-.51-.58-.18l-10.66 6.71-4.59-1.43c-1-.31-1.02-1 .21-1.48l17.94-6.92c.83-.31 1.56.2 1.29 1.43z" />
    </svg>
  );
}
