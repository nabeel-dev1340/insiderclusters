import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Standard responsive page gutter + max width. One component so every section
 * lines up on the same grid across all breakpoints.
 */
export function Container({
  className,
  size = "md",
  ...props
}: ComponentProps<"div"> & { size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        size === "lg" ? "max-w-7xl" : "max-w-6xl",
        className,
      )}
      {...props}
    />
  );
}
