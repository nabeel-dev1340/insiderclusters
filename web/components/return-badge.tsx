import { cn } from "@/lib/cn";
import { formatSignedPercent } from "@/lib/format";

// "Return since cluster" pill: how the latest price compares to the volume-
// weighted price insiders paid. Emerald (accent) = insiders are up, danger =
// underwater — the "Price < Cost 🔥" idea competitors surface. Renders nothing
// when we don't have a price + VWAP to compare.
export function ReturnBadge({
  fraction,
  className,
}: {
  fraction: number | null | undefined;
  className?: string;
}) {
  if (fraction == null || !Number.isFinite(fraction)) return null;
  const up = fraction >= 0;
  return (
    <span
      title="Return from the price insiders paid (VWAP) to the latest price"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        up
          ? "bg-accent/10 text-accent"
          : "bg-danger/10 text-danger",
        className
      )}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {formatSignedPercent(fraction)}
    </span>
  );
}
