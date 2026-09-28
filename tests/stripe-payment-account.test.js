import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyStripePaymentAccount,
  stripeAccountToPaymentAccount,
} from "../src/lib/stripe/server.js";

const entry = (description, status, awaitingActionFrom = "user") => ({
  awaiting_action_from: awaitingActionFrom,
  description,
  errors: [],
  impact: { restricts_capabilities: [] },
  minimum_deadline: { status },
  requested_reasons: [{ code: "routine_onboarding" }],
});

// A v2 account as API version 2026-08-26.preview returns it: the outstanding
// items are in `requirements.entries`, and `requirements.summary` only carries
// the strictest deadline. Reading lists from the summary stored every account
// with no requirements, so a restricted provider lost the button to resume
// onboarding (seen in a Stripe test sandbox on 2026-09-28).
function restrictedAccount(entries) {
  return {
    id: "acct_test_restricted",
    dashboard: "express",
    identity: { country: "GB" },
    configuration: {
      recipient: {
        applied: true,
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status: "restricted" },
            payouts: { status: "restricted" },
          },
        },
      },
    },
    requirements: {
      entries,
      summary: { minimum_deadline: { status: "past_due", time: null } },
    },
  };
}

test("requirement entries are sorted into lists by their deadline", () => {
  const values = stripeAccountToPaymentAccount(
    restrictedAccount([
      entry("external_account", "past_due"),
      entry("representative.date_of_birth.day", "past_due"),
      entry("representative.address.line1", "currently_due"),
      entry("business_profile.url", "eventually_due"),
    ]),
  );

  assert.deepEqual(values.requirements_past_due, [
    "external_account",
    "representative.date_of_birth.day",
  ]);
  assert.deepEqual(values.requirements_currently_due, [
    "representative.address.line1",
  ]);
  assert.deepEqual(values.requirements_eventually_due, ["business_profile.url"]);
});

test("entries Stripe is working on, and repeated items, are not listed for the provider", () => {
  const values = stripeAccountToPaymentAccount(
    restrictedAccount([
      entry("representative.verification.document", "past_due", "stripe"),
      entry("external_account", "past_due"),
      entry("external_account", "past_due"),
    ]),
  );

  assert.deepEqual(values.requirements_past_due, ["external_account"]);
});

test("an account without requirement entries stores empty lists", () => {
  for (const requirements of [undefined, null, {}, { summary: {} }]) {
    const values = stripeAccountToPaymentAccount({
      ...restrictedAccount([]),
      requirements,
    });

    assert.deepEqual(values.requirements_currently_due, []);
    assert.deepEqual(values.requirements_past_due, []);
    assert.deepEqual(values.requirements_eventually_due, []);
  }
});

test("a restricted account with past-due entries can resume onboarding", () => {
  const past = Array.from({ length: 12 }, (_, index) =>
    entry(`representative.item_${index}`, "past_due"),
  );
  const state = classifyStripePaymentAccount(
    stripeAccountToPaymentAccount(restrictedAccount(past)),
  );

  assert.equal(state.state, "restricted");
  assert.equal(state.canCreateOnboardingLink, true);
  assert.equal(
    state.message,
    "Stripe needs more information before payments can be enabled.",
  );
});

test("a restricted account waiting only on Stripe offers no onboarding link", () => {
  const state = classifyStripePaymentAccount(
    stripeAccountToPaymentAccount(
      restrictedAccount([
        entry("representative.verification.document", "past_due", "stripe"),
      ]),
    ),
  );

  assert.equal(state.state, "restricted");
  assert.equal(state.canCreateOnboardingLink, false);
});
