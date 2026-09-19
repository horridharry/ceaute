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

// The bracketed values src/lib/legal/identity.js shipped before the real
// operator details landed. Kept here so the Production gate stays under test
// against exactly the shape of input it exists to refuse.
const UNRESOLVED = {
  ...RESOLVED,
  operatorName: "[FULL LEGAL NAME]",
  businessAddress: "[BUSINESS ADDRESS]",
  addressForService: "[UK ADDRESS FOR SERVICE]",
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

test("placeholder operator details still fail the Production gate", () => {
  assert.equal(hasUnresolvedLegalIdentity(UNRESOLVED), true);
  assert.throws(
    () => assertLegalIdentityResolved(UNRESOLVED),
    /Legal identity is incomplete/,
  );
});

test("the gate names every unresolved field so the error is actionable", () => {
  assert.deepEqual(unresolvedLegalIdentityFields(UNRESOLVED), [
    "operatorName",
    "businessAddress",
    "addressForService",
  ]);
  assert.throws(
    () => assertLegalIdentityResolved(UNRESOLVED),
    (error) =>
      unresolvedLegalIdentityFields(UNRESOLVED).every((field) =>
        error.message.includes(field),
      ),
  );
});

test("the shipped identity is resolved, so Production is no longer blocked", () => {
  // The placeholders were replaced with the real operator details, so the
  // gate now passes on the shipped values. If this ever fails again, the fix
  // is to restore real values in src/lib/legal/identity.js — never to relax
  // the gate.
  assert.deepEqual(unresolvedLegalIdentityFields(), []);
  assert.equal(hasUnresolvedLegalIdentity(), false);
  assert.doesNotThrow(() => assertLegalIdentityResolved());
});

test("every required disclosure on the shipped identity is a real value", () => {
  // Guards the other direction: the gate passes because the details are real,
  // not because a required field was quietly dropped or bracketed.
  for (const field of [
    "tradingName",
    "operatorName",
    "businessAddress",
    "addressForService",
    "contactEmail",
  ]) {
    assert.ok(legalIdentity[field], `${field} must be set`);
    assert.equal(
      isPlaceholder(legalIdentity[field]),
      false,
      `${field} must not be a placeholder`,
    );
  }
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
