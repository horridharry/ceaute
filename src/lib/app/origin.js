// Single source of truth for Ceaute's own origin — the scheme and host every
// absolute URL the server builds is hung off: booking-email links, Stripe
// Checkout success/cancel URLs, and Stripe Connect onboarding return URLs.
//
// Three environments, two rules:
//
//   * Vercel Preview resolves to the deployment currently serving the request,
//     `https://${VERCEL_URL}`. Every preview gets a fresh hostname, so a fixed
//     value would send a tester on a preview back to Production halfway
//     through the journey they are testing.
//   * Production and local development resolve to the configured
//     CEAUTE_APP_URL. Production must stay pinned to the canonical origin:
//     Stripe bakes success_url and cancel_url into the Session and they are
//     persisted with the payment attempt, so a paying customer must land back
//     on https://ceaute.com and not on whatever host happened to serve the
//     request.
//
// VERCEL_URL is set by Vercel itself from the deployment, never from the
// request, so it is not attacker-controlled the way Host or Origin headers
// are. It is still deliberately confined to Preview.

function normalise(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

export function resolveApplicationOrigin(environment = process.env) {
  if (environment.VERCEL_ENV === "preview") {
    const previewHost = normalise(environment.VERCEL_URL);

    if (previewHost) {
      return `https://${previewHost}`;
    }
  }

  return normalise(environment.CEAUTE_APP_URL);
}

// The origin an in-flight request should build absolute URLs from.
//
// The resolver above answers in every deployed environment, so the request
// headers are only reached in local development with CEAUTE_APP_URL unset.
// They are user-controlled, which is exactly why they must never decide a
// Production or Preview origin.
export function resolveRequestOrigin(headerStore, environment = process.env) {
  const resolvedOrigin = resolveApplicationOrigin(environment);

  if (resolvedOrigin) {
    return resolvedOrigin;
  }

  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Could not determine the application origin.");
  }

  return `${protocol}://${host}`;
}
