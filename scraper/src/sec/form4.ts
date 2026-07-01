// Network wrapper around the pure Form 4 parser (Feature 1.2).
// Re-exports the parser and its types, and adds the fetch step.

import { fetchText } from "./client.ts";
import { parseForm4Xml, type ParsedFiling } from "../form4.parse.ts";

export * from "../form4.parse.ts";

/** Fetch a submission .txt and parse it into a structured filing. */
export async function fetchAndParseFiling(submissionUrl: string): Promise<ParsedFiling> {
  const txt = await fetchText(submissionUrl);
  return parseForm4Xml(txt);
}
