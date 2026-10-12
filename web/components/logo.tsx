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
        "relative grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground",
        className,
      )}
    >
      <BrandMark className="h-[56%] w-[56%]" />
    </span>
  );
}
