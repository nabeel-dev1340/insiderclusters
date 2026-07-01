"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type Status = "idle" | "submitting" | "sent" | "error";

export function LoginForm({
  next,
  autoFocus = true,
  layout = "stack",
  cta = "Send magic link",
}: {
  next?: string;
  autoFocus?: boolean;
  /** "row" keeps the email + button on one line (hero); "stack" is vertical. */
  layout?: "stack" | "row";
  cta?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage(null);
    setDevLink(null);

    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      const data = (await res.json()) as { error?: string; devLink?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("sent");
      setMessage("Check your email for a sign-in link.");
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">{message}</p>
        {devLink && (
          <p className="mt-2 break-all text-xs text-muted">
            Dev link:{" "}
            <a className="text-accent underline" href={devLink}>
              {devLink}
            </a>
          </p>
        )}
      </div>
    );
  }

  const isRow = layout === "row";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <div
        className={cn("flex gap-2.5", isRow ? "flex-col sm:flex-row" : "flex-col")}
      >
        <Input
          type="email"
          required
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
        />
        <Button
          type="submit"
          disabled={status === "submitting"}
          className="shrink-0"
        >
          {status === "submitting" ? "Sending…" : cta}
        </Button>
      </div>
      {status === "error" && message && (
        <p className="text-sm text-danger">{message}</p>
      )}
    </form>
  );
}
