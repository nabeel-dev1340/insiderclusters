import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "muted";

const tones: Record<Tone, string> = {
  neutral:
    "border-border bg-surface-muted text-foreground",
  accent:
    "border-accent/30 bg-accent/10 text-accent",
  muted: "border-border bg-transparent text-muted",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
