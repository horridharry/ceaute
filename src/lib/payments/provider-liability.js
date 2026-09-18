// What a provider owes Ceaute, when they owe it, and when that stops them
// taking more bookings.
//
// The liability policy itself is settled (see decision 004 and the refund
// economics report) and is not reopened here. This module answers the three
// questions the policy leaves to the implementation: how much debt a lost
// dispute creates, how much of it Stripe can actually take back, and whether a
// provider carrying debt may create more exposure.

// Bumped whenever the provider agreement's substance changes. Acceptance is
// recorded against this exact string, so an older acceptance stops counting.
export const PROVIDER_AGREEMENT_VERSION = "2026-09-18";

// Any outstanding liability restricts. A marketplace that lets a provider who
// already owes money take more paid bookings is choosing to lend them more,
// and private alpha is the wrong time to be a lender.
export const PROVIDER_DEBT_RESTRICTION_THRESHOLD_PENCE = 1;

function toPence(value) {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.trunc(amount) : 0;
}

// The debt a lost dispute creates. Deliberately narrow:
//
//   * the reversed payment amount is the provider's, per the settled rule;
//   * Stripe's dispute fee is NOT included — Stripe's Connect terms forbid
//     passing it to a connected account, so it is Ceaute's cost and recording
//     it as provider debt would be recording a debt Ceaute may not collect;
//   * the non-refundable processing cost is NOT included — the settled rule
//     puts that with Ceaute on a dispute;
//   * a Ceaute-caused dispute creates no provider debt at all.
export function describeProviderDisputeLiability({
  disputedAmountPence,
  responsibility,
  disputeStatus,
}) {
  const disputed = Math.max(0, toPence(disputedAmountPence));
  const lost = disputeStatus === "lost";

  if (!lost || responsibility !== "provider") {
    return {
      createsLiability: false,
      amountOwedPence: 0,
      reason:
        responsibility === "ceaute"
          ? "Ceaute caused the dispute and bears the loss."
          : !lost
            ? "The dispute is not lost."
            : "Responsibility is not the provider's.",
    };
  }

  return {
    createsLiability: true,
    amountOwedPence: disputed,
    reason: "dispute_lost_provider_responsible",
    // Stated so nobody later "improves" this by adding it.
    excludesDisputeFee: true,
  };
}

// How much of a debt a transfer reversal can actually take back right now.
// Stripe reverses from the connected account's available balance and rejects
// the whole request when it is short, so asking for a number we know it cannot
// meet turns a partial recovery into no recovery.
export function planLiabilityRecovery({
  outstandingPence,
  transferReversiblePence,
  connectedAvailablePence,
}) {
  const outstanding = Math.max(0, toPence(outstandingPence));
  const reversible = Math.max(0, toPence(transferReversiblePence));
  const available = Math.max(0, toPence(connectedAvailablePence));
  const recoverablePence = Math.min(outstanding, reversible, available);

  return {
    recoverablePence,
    // What is left over is a debt, not a failure to be retried into a loop.
    remainingPence: outstanding - recoverablePence,
    canRecover: recoverablePence > 0,
    blockedReason:
      recoverablePence > 0
        ? null
        : outstanding === 0
          ? "Nothing outstanding."
          : reversible === 0
            ? "The transfer has already been fully reversed."
            : "The connected account has no available balance to reverse.",
  };
}

// Whether a provider may take another paid booking. Two independent gates:
// money owed, and the agreement they are owed it under.
export function describeProviderRestriction({
  outstandingPence,
  acceptedAgreementVersion,
  requiredAgreementVersion = PROVIDER_AGREEMENT_VERSION,
  thresholdPence = PROVIDER_DEBT_RESTRICTION_THRESHOLD_PENCE,
}) {
  const outstanding = Math.max(0, toPence(outstandingPence));
  const reasons = [];

  if (outstanding >= thresholdPence) {
    reasons.push("outstanding_liability");
  }

  if (acceptedAgreementVersion !== requiredAgreementVersion) {
    reasons.push("agreement_not_accepted");
  }

  return {
    restricted: reasons.length > 0,
    reasons,
    outstandingPence: outstanding,
    requiredAgreementVersion,
    acceptedAgreementVersion: acceptedAgreementVersion ?? null,
  };
}

// One short sentence for the provider's own screen. Never blames a customer
// and never implies Ceaute will take the money automatically, because it
// cannot.
export function describeRestrictionForProvider(restriction) {
  if (!restriction.restricted) {
    return "";
  }

  if (restriction.reasons.includes("agreement_not_accepted")) {
    return "Accept the provider agreement to take paid bookings.";
  }

  return "New bookings are paused while there is an unpaid balance on your account. Contact Ceaute to settle it.";
}
