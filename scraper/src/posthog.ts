import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

export function posthog(): PostHog {
  if (!_client) {
    _client = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      enableExceptionAutocapture: true,
    });
  }
  return _client;
}
