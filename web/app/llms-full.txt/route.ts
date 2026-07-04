import { buildLlmsFull } from "@/lib/llms";

// llms-full.txt: the llms.txt index plus the complete text of every learn
// article, converted from the JSX registry to markdown. Fully static —
// content only changes on deploy.
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsFull(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Readable by every crawler, but kept out of classic search indexes so
      // the raw text never competes with the HTML pages it mirrors.
      "X-Robots-Tag": "noindex",
    },
  });
}
