import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Token-styled text input, consistent with the Button/Card design system. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-sm border border-border bg-surface px-3.5 text-base text-foreground",
        "placeholder:text-muted transition-colors",
        "focus:border-accent/50 focus-visible:outline-none",
        "disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
