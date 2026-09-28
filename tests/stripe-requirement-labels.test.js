import assert from "node:assert/strict";
import test from "node:test";
import { describeStripeRequirements } from "../src/app/(dashboard)/dashboard/settings/payments/_lib/requirement-labels.js";

// The past-due requirements of a UK recipient account left part-way through
// Stripe onboarding, as the local Stripe sandbox returned them on 2026-09-28.
const sandboxRequirements = [
  "external_account",
  "identity.attestations.terms_of_service.account.date",
  "identity.attestations.terms_of_service.account.ip",
  "identity.entity_type",
  "representative.address.city",
  "representative.address.line1",
  "representative.address.postal_code",
  "representative.date_of_birth.day",
  "representative.date_of_birth.month",
  "representative.date_of_birth.year",
  "representative.given_name",
  "representative.surname",
];

test("Stripe's requirement paths become one readable line per detail, in a natural order", () => {
  assert.deepEqual(describeStripeRequirements(sandboxRequirements), [
    "Legal name",
    "Date of birth",
    "Home address",
    "Business type",
    "Bank account for payouts",
    "Accept Stripe's terms",
  ]);
});

test("a business address is not called a home address", () => {
  assert.deepEqual(
    describeStripeRequirements([
      "identity.individual.address.line1",
      "identity.business_details.address.postal_code",
    ]),
    ["Home address", "Business address"],
  );
});

test("identity documents are told apart", () => {
  assert.deepEqual(
    describeStripeRequirements([
      "representative.verification.additional_document",
      "representative.verification.document",
    ]),
    ["Photo ID", "Proof of address"],
  );
});

test("unrecognised requirements are summarised once, last, and never shown raw", () => {
  const labels = describeStripeRequirements([
    "some.future.requirement",
    "representative.date_of_birth.day",
    "another.unknown_thing",
  ]);

  assert.deepEqual(labels, ["Date of birth", "Other details"]);
  assert.ok(labels.every((label) => !label.includes(".") && !label.includes("_")));
});

test("no requirements means no lines", () => {
  assert.deepEqual(describeStripeRequirements([]), []);
  assert.deepEqual(describeStripeRequirements(undefined), []);
});
