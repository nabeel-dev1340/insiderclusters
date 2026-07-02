import { cn } from "@/lib/cn";

// "High conviction" marker: a cluster that includes a C-suite / named executive
// officer, not just directors or passive 10% owners. This is the single most
// useful idea our competitors (13Radar, InsiderAction) surface — a CEO/CFO
// buying alongside others is a materially stronger signal — so we give it a
// solid accent chip that stands apart from the outline "N insiders" badge.
export function ConvictionBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "xs";
}) {
  return (
    <span
      title="High conviction: a C-suite officer bought alongside other insiders — historically the strongest cluster signal."
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-accent font-semibold text-accent-foreground",
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        className
      )}
    >
      <SparkIcon />
      High conviction
    </span>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-3 w-3"
      fill="currentColor"
    >
      {/* four-point spark / signal */}
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}
