import assert from "node:assert/strict";
import test from "node:test";
import {
  assertStripeKeyMatchesMode,
  describeStripeKeyMode,
  eventMatchesStripeMode,
  resolveStripeMode,
} from "../src/lib/stripe/mode.js";

test("an unset STRIPE_MODE means test, so Production stays where it is", () => {
  assert.equal(resolveStripeMode({}), "test");
  assert.equal(resolveStripeMode({ STRIPE_MODE: "" }), "test");
  assert.equal(resolveStripeMode({ STRIPE_MODE: "  " }), "test");
});

test("STRIPE_MODE is read case- and whitespace-insensitively", () => {
  assert.equal(resolveStripeMode({ STRIPE_MODE: "LIVE" }), "live");
  assert.equal(resolveStripeMode({ STRIPE_MODE: " live " }), "live");
});

test("an unrecognised STRIPE_MODE fails rather than defaulting", () => {
  // Silently falling back to test would be the wrong failure: a typo like
  // "production" must not quietly disable live mode.
  assert.throws(
    () => resolveStripeMode({ STRIPE_MODE: "production" }),
    /must be "test" or "live"/,
  );
});

test("secret and restricted keys both carry a recognisable mode", () => {
  assert.equal(describeStripeKeyMode("sk_test_abc"), "test");
  assert.equal(describeStripeKeyMode("sk_live_abc"), "live");
  assert.equal(describeStripeKeyMode("rk_test_abc"), "test");
  assert.equal(describeStripeKeyMode("rk_live_abc"), "live");
  assert.equal(describeStripeKeyMode("pk_live_abc"), null);
  assert.equal(describeStripeKeyMode(""), null);
  assert.equal(describeStripeKeyMode(undefined), null);
});

test("a matching key and mode pass", () => {
  assert.doesNotThrow(() => assertStripeKeyMatchesMode("sk_test_abc", "test"));
  assert.doesNotThrow(() => assertStripeKeyMatchesMode("sk_live_abc", "live"));
});

test("a test key declared live is refused, and so is the reverse", () => {
  assert.throws(
    () => assertStripeKeyMatchesMode("sk_test_abc", "live"),
    /STRIPE_MODE=live but STRIPE_SECRET_KEY is a test-mode key/,
  );
  assert.throws(
    () => assertStripeKeyMatchesMode("sk_live_abc", "test"),
    /STRIPE_MODE=test but STRIPE_SECRET_KEY is a live-mode key/,
  );
});

test("a key that is not a Stripe secret key is refused with the expected prefix", () => {
  assert.throws(
    () => assertStripeKeyMatchesMode("whsec_abc", "live"),
    /Expected it to start with sk_live_/,
  );
});

test("an event is accepted only when its livemode matches the declared mode", () => {
  assert.equal(eventMatchesStripeMode({ livemode: false }, "test"), true);
  assert.equal(eventMatchesStripeMode({ livemode: true }, "live"), true);
  assert.equal(eventMatchesStripeMode({ livemode: true }, "test"), false);
  assert.equal(eventMatchesStripeMode({ livemode: false }, "live"), false);
});

test("an event with no usable livemode is rejected rather than assumed", () => {
  assert.equal(eventMatchesStripeMode({}, "test"), false);
  assert.equal(eventMatchesStripeMode({ livemode: "false" }, "test"), false);
  assert.equal(eventMatchesStripeMode(null, "test"), false);
});
