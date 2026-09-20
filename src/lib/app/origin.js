// Single source of truth for Ceaute's own origin — the scheme and host every
// absolute URL the server builds is hung off: booking-email links, Stripe
// Checkout success/cancel URLs, and Stripe Connect onboarding return URLs.
//
// Three environments, one canonical rule and one fallback:
//
//   * Every environment uses its explicitly configured CEAUTE_APP_URL. Preview
//     and Production each have a permanent customer-facing domain, while local
//     development normally configures http://localhost:3000.
//   * An unconfigured Vercel Preview falls back to its generated VERCEL_URL so
//     an ad-hoc deployment can still build absolute URLs.
//
// Stripe persists Checkout success/cancel URLs and Connect return URLs, so a
// generated deployment hostname must never override the configured canonical
// domain. VERCEL_URL is set by Vercel rather than the request and remains
// deliberately confined to the Preview fallback.

function normalise(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

export function resolveApplicationOrigin(environment = process.env) {
  const configuredOrigin = normalise(environment.CEAUTE_APP_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (environment.VERCEL_ENV === "preview") {
    const previewHost = normalise(environment.VERCEL_URL);

    if (previewHost) {
      return `https://${previewHost}`;
    }
  }

  return null;
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
