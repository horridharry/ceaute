import assert from "node:assert/strict";
import test from "node:test";
import {
  PROVIDER_AGREEMENT_VERSION,
  describeProviderDisputeLiability,
  describeProviderRestriction,
  describeRestrictionForProvider,
  planLiabilityRecovery,
} from "../src/lib/payments/provider-liability.js";
import { STRIPE_UK_DISPUTE_FEE_PENCE } from "../src/lib/payments/refund-settlement.js";

const DEPOSIT_PENCE = 1000;

test("a lost provider-responsible dispute owes the reversed payment amount", () => {
  const liability = describeProviderDisputeLiability({
    disputedAmountPence: DEPOSIT_PENCE,
    responsibility: "provider",
    disputeStatus: "lost",
  });

  assert.equal(liability.createsLiability, true);
  assert.equal(liability.amountOwedPence, DEPOSIT_PENCE);
});

test("Stripe's dispute fee is never recorded as provider debt", () => {
  // Stripe's Connect terms forbid passing it to a connected account, so
  // recording it would be booking a debt Ceaute may not collect.
  const liability = describeProviderDisputeLiability({
    disputedAmountPence: DEPOSIT_PENCE,
    responsibility: "provider",
    disputeStatus: "lost",
  });

  assert.equal(liability.amountOwedPence, DEPOSIT_PENCE);
  assert.notEqual(
    liability.amountOwedPence,
    DEPOSIT_PENCE + STRIPE_UK_DISPUTE_FEE_PENCE,
  );
  assert.equal(liability.excludesDisputeFee, true);
});

test("a Ceaute-caused dispute creates no provider debt", () => {
  const liability = describeProviderDisputeLiability({
    disputedAmountPence: DEPOSIT_PENCE,
    responsibility: "ceaute",
    disputeStatus: "lost",
  });

  assert.equal(liability.createsLiability, false);
  assert.equal(liability.amountOwedPence, 0);
  assert.match(liability.reason, /Ceaute caused the dispute/);
});

test("a won or undecided dispute creates no debt", () => {
  for (const disputeStatus of ["won", "needs_response", "under_review"]) {
    assert.equal(
      describeProviderDisputeLiability({
        disputedAmountPence: DEPOSIT_PENCE,
        responsibility: "provider",
        disputeStatus,
      }).createsLiability,
      false,
    );
  }

  assert.equal(
    describeProviderDisputeLiability({
      disputedAmountPence: DEPOSIT_PENCE,
      responsibility: "undetermined",
      disputeStatus: "lost",
    }).createsLiability,
    false,
  );
});

test("recovery takes the most Stripe can actually reverse, not the most owed", () => {
  // The provider received £9.45 of the £10.00 and still holds it.
  const plan = planLiabilityRecovery({
    outstandingPence: 1000,
    transferReversiblePence: 945,
    connectedAvailablePence: 945,
  });

  assert.equal(plan.recoverablePence, 945);
  assert.equal(plan.remainingPence, 55, "the rest stays a debt");
  assert.equal(plan.canRecover, true);
});

test("a paid-out provider yields no recovery and the whole amount stays owed", () => {
  const plan = planLiabilityRecovery({
    outstandingPence: 1000,
    transferReversiblePence: 945,
    connectedAvailablePence: 0,
  });

  assert.equal(plan.recoverablePence, 0);
  assert.equal(plan.remainingPence, 1000);
  assert.equal(plan.canRecover, false);
  assert.match(plan.blockedReason, /no available balance/);
});

test("a partly drained balance recovers what is there and owes the rest", () => {
  const plan = planLiabilityRecovery({
    outstandingPence: 1000,
    transferReversiblePence: 945,
    connectedAvailablePence: 400,
  });

  assert.equal(plan.recoverablePence, 400);
  assert.equal(plan.remainingPence, 600);
});

test("recovery never exceeds what was transferred, however large the balance", () => {
  const plan = planLiabilityRecovery({
    outstandingPence: 1000,
    transferReversiblePence: 945,
    connectedAvailablePence: 100_000,
  });

  assert.equal(plan.recoverablePence, 945);
});

test("an already-reversed transfer cannot be reversed again", () => {
  const plan = planLiabilityRecovery({
    outstandingPence: 500,
    transferReversiblePence: 0,
    connectedAvailablePence: 10_000,
  });

  assert.equal(plan.recoverablePence, 0);
  assert.match(plan.blockedReason, /already been fully reversed/);
});

test("nothing outstanding means nothing to recover", () => {
  const plan = planLiabilityRecovery({
    outstandingPence: 0,
    transferReversiblePence: 945,
    connectedAvailablePence: 945,
  });

  assert.equal(plan.recoverablePence, 0);
  assert.equal(plan.blockedReason, "Nothing outstanding.");
});

test("a provider with debt is restricted from taking more paid bookings", () => {
  const restriction = describeProviderRestriction({
    outstandingPence: 600,
    acceptedAgreementVersion: PROVIDER_AGREEMENT_VERSION,
  });

  assert.equal(restriction.restricted, true);
  assert.deepEqual(restriction.reasons, ["outstanding_liability"]);
  assert.match(describeRestrictionForProvider(restriction), /unpaid balance/);
});

test("a provider who has not accepted the agreement is restricted too", () => {
  for (const acceptedAgreementVersion of [null, undefined, "2020-01-01"]) {
    const restriction = describeProviderRestriction({
      outstandingPence: 0,
      acceptedAgreementVersion,
    });

    assert.equal(restriction.restricted, true);
    assert.deepEqual(restriction.reasons, ["agreement_not_accepted"]);
    assert.match(
      describeRestrictionForProvider(restriction),
      /Accept the provider agreement/,
    );
  }
});

test("both gates can fail at once, and the agreement message wins", () => {
  const restriction = describeProviderRestriction({
    outstandingPence: 600,
    acceptedAgreementVersion: null,
  });

  assert.deepEqual(restriction.reasons, [
    "outstanding_liability",
    "agreement_not_accepted",
  ]);
  assert.match(
    describeRestrictionForProvider(restriction),
    /Accept the provider agreement/,
  );
});

test("a clean provider on the current agreement is unrestricted", () => {
  const restriction = describeProviderRestriction({
    outstandingPence: 0,
    acceptedAgreementVersion: PROVIDER_AGREEMENT_VERSION,
  });

  assert.equal(restriction.restricted, false);
  assert.deepEqual(restriction.reasons, []);
  assert.equal(describeRestrictionForProvider(restriction), "");
});

test("a single penny of debt is enough to restrict", () => {
  // Conservative on purpose: the alternative is choosing a tolerance nobody
  // has agreed, and lending providers money by default.
  assert.equal(
    describeProviderRestriction({
      outstandingPence: 1,
      acceptedAgreementVersion: PROVIDER_AGREEMENT_VERSION,
    }).restricted,
    true,
  );
  assert.equal(
    describeProviderRestriction({
      outstandingPence: 0,
      acceptedAgreementVersion: PROVIDER_AGREEMENT_VERSION,
    }).restricted,
    false,
  );
});

test("an older accepted version does not satisfy the current one", () => {
  const restriction = describeProviderRestriction({
    outstandingPence: 0,
    acceptedAgreementVersion: "2026-01-01",
    requiredAgreementVersion: "2026-09-18",
  });

  assert.equal(restriction.restricted, true);
  assert.deepEqual(restriction.reasons, ["agreement_not_accepted"]);
});
