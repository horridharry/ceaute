// Ceaute declares which Stripe mode it is running in, rather than inferring it
// from the deployment environment. Two reasons:
//
//   * Production has legitimately run in Test mode throughout the private
//     alpha, so "production means live" would be wrong today and would break
//     the current deployment.
//   * Going live then takes two deliberate changes that must agree —
//     STRIPE_MODE=live and an sk_live_ key. Changing one without the other
//     fails fast at the first Stripe call instead of silently operating in the
//     wrong mode.
//
// Nothing here activates Live. It only makes the current mode explicit and
// refuses combinations that are certainly wrong.

export const STRIPE_MODES = ["test", "live"];

const KEY_PREFIX = {
  test: "sk_test_",
  live: "sk_live_",
};

// Restricted keys are a legitimate production choice and carry the mode in the
// same position, so they are accepted alongside the standard secret keys.
const RESTRICTED_KEY_PREFIX = {
  test: "rk_test_",
  live: "rk_live_",
};

export function resolveStripeMode(environment = process.env) {
  const declared = String(environment.STRIPE_MODE ?? "").trim().toLowerCase();

  if (!declared) {
    return "test";
  }

  if (!STRIPE_MODES.includes(declared)) {
    throw new Error(
      `STRIPE_MODE must be "test" or "live", not "${declared}".`,
    );
  }

  return declared;
}

export function describeStripeKeyMode(secretKey) {
  const key = String(secretKey ?? "");

  for (const mode of STRIPE_MODES) {
    if (key.startsWith(KEY_PREFIX[mode]) || key.startsWith(RESTRICTED_KEY_PREFIX[mode])) {
      return mode;
    }
  }

  return null;
}

// Throws rather than returning a flag: a key that does not match the declared
// mode must stop the request, not be worked around by the caller.
export function assertStripeKeyMatchesMode(secretKey, mode) {
  const keyMode = describeStripeKeyMode(secretKey);

  if (keyMode === null) {
    throw new Error(
      `STRIPE_SECRET_KEY is not a recognisable Stripe secret key. ` +
        `Expected it to start with ${KEY_PREFIX[mode]} for STRIPE_MODE=${mode}.`,
    );
  }

  if (keyMode !== mode) {
    throw new Error(
      `Stripe key mode mismatch: STRIPE_MODE=${mode} but STRIPE_SECRET_KEY is ` +
        `a ${keyMode}-mode key. Set both to the same mode.`,
    );
  }
}

// Stripe stamps every event with `livemode`. A correctly signed event from the
// other mode is a misconfigured endpoint, not a replay, so the route rejects it
// instead of processing it against live data.
export function eventMatchesStripeMode(event, mode) {
  if (typeof event?.livemode !== "boolean") {
    return false;
  }

  return event.livemode === (mode === "live");
}
