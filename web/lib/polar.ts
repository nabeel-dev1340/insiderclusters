import "server-only";

import { Polar } from "@polar-sh/sdk";

// Shared Polar SDK client (billing, Phase 4). POLAR_SERVER selects the Polar
// environment ("production" or "sandbox") so switching is an env change only —
// never hardcode it. The org access token scopes every call to our org.
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
});
