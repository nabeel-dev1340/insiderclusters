import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Content stays visible without JavaScript; motion is confined to the hero. */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  return <div className={cn(className)}>{children}</div>;
}
