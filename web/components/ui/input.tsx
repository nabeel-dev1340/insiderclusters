import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Token-styled text input, consistent with the Button/Card design system. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground",
        "placeholder:text-muted/70 shadow-sm transition-colors",
        "focus:border-accent/50 focus-visible:outline-none",
        "disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}
