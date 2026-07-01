// Minimal className combiner (avoids a clsx dependency for our simple needs).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
