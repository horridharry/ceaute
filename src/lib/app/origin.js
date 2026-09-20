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

// A value configured through a dashboard or a .env file frequently arrives
// wrapped in the quotes it was pasted with. `"https://preview.ceaute.com"` and
// `https://preview.ceaute.com` are indistinguishable when read back by eye, but
// the first produces a callback URL that does not start with https:// and that
// Stripe rejects outright. Strip the quotes rather than propagate them.
function stripSurroundingQuotes(value) {
  const quoted = /^(["'])([\s\S]*)\1$/.exec(value);

  return quoted ? quoted[2] : value;
}

function normalise(value) {
  if (typeof value !== "string") {
    return null;
  }

  const unquoted = stripSurroundingQuotes(value.trim()).trim();
  const trimmed = unquoted.replace(/\/+$/, "");

  if (!trimmed) {
    return null;
  }

  return trimmed;
}

// Fails closed, in the same spirit as the Stripe mode check: a configured
// origin that is not an absolute http(s) URL cannot build a usable callback,
// and every downstream failure it causes — a Stripe 400, a dead link in a
// booking email — is far harder to read than this message.
function assertUsableOrigin(origin, variableName) {
  let parsed;

  try {
    parsed = new URL(origin);
  } catch {
    parsed = null;
  }

  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
    throw new Error(
      `${variableName} must be an absolute http(s) URL such as ` +
        `https://preview.ceaute.com, not ${JSON.stringify(origin)}.`,
    );
  }

  return origin;
}

export function resolveApplicationOrigin(environment = process.env) {
  const configuredOrigin = normalise(environment.CEAUTE_APP_URL);

  if (configuredOrigin) {
    return assertUsableOrigin(configuredOrigin, "CEAUTE_APP_URL");
  }

  if (environment.VERCEL_ENV === "preview") {
    const previewHost = normalise(environment.VERCEL_URL);

    if (previewHost) {
      return assertUsableOrigin(`https://${previewHost}`, "VERCEL_URL");
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
