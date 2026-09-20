import posthog from "posthog-js";

// Client-side PostHog. Next.js runs this file once, after the document loads
// and before React hydrates, so analytics is ready before the first
// interaction. `defaults` turns on automatic `$pageview` capture, including
// App Router client navigations, so page traffic is tracked without any per-
// route wiring. User identity is attached separately by the mounted
// <PosthogIdentify> component, and custom funnel events are captured on the
// server. Never initialise PostHog anywhere else on the client — a second
// init would double-count events.
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2026-05-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
} else if (process.env.NODE_ENV !== "production") {
  // Missing configuration is a no-op in production so the app still boots, but
  // in development it must be loud: silent misses are exactly why analytics was
  // empty for so long.
  throw new Error(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}
