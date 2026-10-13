import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  getTickerDirectory,
  getSignalOnlyTickers,
  getInsiderDirectoryPage,
} from "./clusters";

// This app uses the existing App Router cache model (Cache Components is off).
// Cache public database results independently of query-string pagination.
// Viewer sessions and account data never enter this shared cache.
const tickerRows = unstable_cache(
  async () =>
    (await getTickerDirectory()).map((t) => ({
      ...t,
      lastDetectedAt: t.lastDetectedAt.toISOString(),
    })),
  ["public-ticker-directory"],
  { revalidate: 3600 },
);

export const getPublicTickerDirectory = cache(async () => {
  return (await tickerRows()).map((t) => ({
    ...t,
    lastDetectedAt: new Date(t.lastDetectedAt),
  }));
});

export const getPublicSignalOnlyTickers = cache(
  unstable_cache(getSignalOnlyTickers, ["public-signal-directory"], {
    revalidate: 3600,
  }),
);

export const getPublicInsiderDirectoryPage = cache(
  unstable_cache(getInsiderDirectoryPage, ["public-insider-directory-page"], {
    revalidate: 3600,
  }),
);
