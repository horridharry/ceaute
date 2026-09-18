import assert from "node:assert/strict";
import test from "node:test";
import {
  describeOperator,
  hasUnresolvedLegalIdentity,
  isPlaceholder,
  legalContactLine,
  legalIdentity,
  needsSeparateAddressForService,
  unresolvedLegalIdentityFields,
  assertLegalIdentityResolved,
} from "../src/lib/legal/identity.js";

const RESOLVED = {
  tradingName: "Ceaute",
  structure: "sole trader",
  siteDomain: "ceaute.com",
  operatorName: "A Real Name",
  businessAddress: "1 Real Street, London, E1 1AA",
  addressForService: "1 Real Street, London, E1 1AA",
  contactEmail: "hello@ceaute.com",
};

test("a bracketed value is a placeholder and a real value is not", () => {
  assert.equal(isPlaceholder("[FULL LEGAL NAME]"), true);
  assert.equal(isPlaceholder("  [BUSINESS ADDRESS]  "), true);
  assert.equal(isPlaceholder("1 Real Street, London, E1 1AA"), false);
  assert.equal(isPlaceholder(""), false);
  assert.equal(isPlaceholder(undefined), false);
});

test("an empty required field counts as unresolved, not merely falsy", () => {
  const missing = { ...RESOLVED, contactEmail: "" };

  assert.deepEqual(unresolvedLegalIdentityFields(missing), ["contactEmail"]);
});

test("descriptive copy is not treated as a disclosure duty", () => {
  // `structure` and `siteDomain` carry no statutory disclosure of their own,
  // so a placeholder there must not be reported as a compliance gap.
  const odd = { ...RESOLVED, structure: "[STRUCTURE]" };

  assert.deepEqual(unresolvedLegalIdentityFields(odd), []);
});

test("a fully resolved identity passes the build gate", () => {
  assert.equal(hasUnresolvedLegalIdentity(RESOLVED), false);
  assert.doesNotThrow(() => assertLegalIdentityResolved(RESOLVED));
});

test("the gate names every unresolved field so the error is actionable", () => {
  assert.throws(
    () => assertLegalIdentityResolved(legalIdentity),
    (error) =>
      unresolvedLegalIdentityFields(legalIdentity).every((field) =>
        error.message.includes(field),
      ),
  );
});

test("the shipped identity is still unresolved, so Production stays blocked", () => {
  // This test is expected to fail the day the real details land. When it does,
  // delete it — that is the signal the placeholders are gone.
  assert.equal(hasUnresolvedLegalIdentity(), true);
  assert.deepEqual(unresolvedLegalIdentityFields(), [
    "operatorName",
    "businessAddress",
    "addressForService",
  ]);
});

test("an address for service is only stated separately when it differs", () => {
  assert.equal(needsSeparateAddressForService(RESOLVED), false);
  assert.equal(
    needsSeparateAddressForService({
      ...RESOLVED,
      addressForService: "c/o An Accountant, 2 Other Street, London, E2 2BB",
    }),
    true,
  );
});

test("the operator sentence and the email line both name the trader", () => {
  assert.equal(
    describeOperator(RESOLVED),
    "Ceaute is a trading name of A Real Name, a sole trader.",
  );
  assert.equal(
    legalContactLine(RESOLVED),
    "Ceaute is a trading name of A Real Name, a sole trader, of " +
      "1 Real Street, London, E1 1AA. Contact: hello@ceaute.com",
  );
});
