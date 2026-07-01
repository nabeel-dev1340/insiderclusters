// HTTP client for SEC EDGAR (Features 1.1, 1.6).
//
// - Always sends the required User-Agent (SEC returns 403 without it).
// - Retries transient failures with exponential backoff + jitter.
// - Serialises requests behind a small delay so we never exceed SEC's rate
//   limit, and so a poll cycle degrades gracefully instead of hammering.

import { config } from "../config.ts";
import { log } from "../logger.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = config.secRequestDelayMs - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * Fetch a URL as text with the SEC User-Agent and retry/backoff.
 * Retries on network errors and 5xx/429; 4xx (except 429) fail fast.
 */
export async function fetchText(
  url: string,
  { retries = 4, baseDelayMs = 1000 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<string> {
  let attempt = 0;
  for (;;) {
    await throttle();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": config.secUserAgent,
          "Accept-Encoding": "gzip, deflate",
        },
      });

      if (res.ok) return await res.text();

      const retriable = res.status === 429 || res.status >= 500;
      if (!retriable || attempt >= retries) throw new HttpError(res.status, url);
      log.warn("http retriable status", { url, status: res.status, attempt });
    } catch (err) {
      if (err instanceof HttpError) throw err; // non-retriable status
      if (attempt >= retries) throw err; // exhausted network retries
      log.warn("http network error, will retry", {
        url,
        attempt,
        error: (err as Error).message,
      });
    }

    // Exponential backoff with full jitter.
    const backoff = baseDelayMs * 2 ** attempt;
    const delay = Math.round(Math.random() * backoff);
    await sleep(delay);
    attempt++;
  }
}
