import { buildLlmsIndex } from "@/lib/llms";

// llms.txt (llmstxt.org): a curated markdown index of the site for AI
// crawlers. Fully static — content only changes on deploy.
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsIndex(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Readable by every crawler, but kept out of classic search indexes so
      // the raw text never competes with the HTML pages it mirrors.
      "X-Robots-Tag": "noindex",
    },
  });
}
