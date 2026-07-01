"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Scroll-triggered entrance animation (fade + rise), framer-motion in spirit
 * but implemented with an IntersectionObserver + CSS transition so it ships no
 * runtime animation library — keeping the page fast for PageSpeed.
 *
 * Content renders in the DOM at all times (only opacity/transform change), so
 * it stays crawlable. Users who prefer reduced motion, or have no JS/IO
 * support, see the final state immediately.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once) {
          setShown(false);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      data-shown={shown}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "translate-y-4 opacity-0 transition-[opacity,transform] duration-700 ease-out will-change-transform",
        "data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100",
        className
      )}
    >
      {children}
    </div>
  );
}
