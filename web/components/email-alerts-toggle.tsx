"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { setEmailAlerts } from "@/app/dashboard/settings/actions";

export function EmailAlertsToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    startTransition(async () => {
      try {
        await setEmailAlerts(next);
      } catch {
        setEnabled(!next); // revert on failure
      }
    });
  }

  return (
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
  );
}
