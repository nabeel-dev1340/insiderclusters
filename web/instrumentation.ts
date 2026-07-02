import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err) => {
  const { posthog } = await import("@/lib/posthog");
  posthog().captureException(err as Error, "system");
};
