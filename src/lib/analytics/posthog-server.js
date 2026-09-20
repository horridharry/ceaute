import { after } from "next/server";
import { PostHog } from "posthog-node";

// Server-side PostHog. The saved customer and provider funnels score on events
// that only the server can vouch for — a confirmed Stripe payment, a validated
// booking hold, a published page — so those are captured here rather than in
// the browser. Each event uses the person's Supabase user id as its distinct
// id, the same id the client <PosthogIdentify> sends, so server and client
// events belong to one person and the funnels join across steps.

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let client = null;

function getClient() {
  if (!token) {
    return null;
  }

  if (!client) {
    // `after` delivers each event once the response has been sent, so a capture
    // never adds a PostHog round-trip to the latency of the action that fired
    // it, while keeping the serverless runtime alive long enough to send it.
    client = new PostHog(token, { host, waitUntil: after });
  }

  return client;
}

// Best-effort: analytics must never break a booking, a payment or a provider
// action. A missing token is a no-op in production and a loud warning in
// development, so the gap is visible while it is still cheap to fix.
export async function captureServerEvent({ distinctId, event, properties }) {
  const posthog = getClient();

  if (!posthog) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }

    return;
  }

  if (!distinctId) {
    return;
  }

  try {
    posthog.capture({ distinctId, event, properties });
  } catch {
    // A failed send is never worth failing the user's action for.
  }
}
