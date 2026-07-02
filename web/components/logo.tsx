import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";

// The single, canonical logo tile: the BrandMark glyph on the accent gradient.
// Every surface (marketing header/footer, login, dashboard nav) renders this so
// the brand reads identically everywhere. Size it via `className` (h-*/w-*); the
// glyph scales to the tile. Callers add group-hover motion where they want it.
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent to-accent-hover text-white ring-1 ring-inset ring-white/20",
        className
      )}
    >
      <BrandMark className="h-[56%] w-[56%]" />
    </span>
  );
}
