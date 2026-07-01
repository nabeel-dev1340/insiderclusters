"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Billing checkout / customer portal is wired in Phase 4 (Lemon Squeezy). Until
// then this surfaces the intent honestly rather than linking to a dead page.
export function BillingButton({ label }: { label: string }) {
  const [clicked, setClicked] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={() => setClicked(true)}>{label}</Button>
      {clicked && (
        <p className="text-xs text-muted">
          Payments go live shortly — checkout is being connected.
        </p>
      )}
    </div>
  );
}
