import {
  CEAUTE_PLATFORM_FEE_BASIS_POINTS,
  calculatePlatformFeePence,
} from "@/lib/payments/booking-payments";

// The canonical settlement rules. Every question of the form "who ends up
// bearing what" is answered here and nowhere else — the refund driver, the
// dispute surface, the provider disclosure and the tests all read from this.
//
// The only lever Stripe gives a destination charge after the fact is how much
// of the application fee is refunded, so that is what these functions decide.
// `reverse_transfer` always returns the customer's money from the provider;
// the application-fee refund then decides whether Ceaute gives back its
// commission, the processing cost it estimated, both, or neither.
//
//   provider receives = amount charged - application fee
//                       - amount reversed + application fee refunded
//
// Nothing here debits a provider. Refunding less of Ceaute's own fee is not a
// debit; it is Ceaute keeping money it already holds. Where a rule needs more
// than that — a lost dispute, an already paid-out provider — the calculation
// still produces the intended numbers, and moving the money stays manual.

export const SETTLEMENT_CAUSES = Object.freeze([
  // Cancelled by the customer before the provider's deadline. A full refund,
  // and a normal operating cost for Ceaute.
  "customer_cancelled_early",
  // Cancelled by the customer after the deadline. The provider keeps what
  // their policy allows and bears the processing cost.
  "customer_cancelled_late",
  // Cancelled by the provider. Full refund; the provider caused the reversal
  // so the processing cost is theirs.
  "provider_cancelled",
  // Duplicate charge, wrong amount, or any Ceaute payment-system fault.
  // Ceaute bears everything and the provider is left whole.
  "ceaute_error",
]);

// Ceaute absorbing the processing cost is the exception, not the rule: it
// applies when the customer did nothing wrong, and when Ceaute itself caused
// the reversal.
const CEAUTE_ABSORBS_PROCESSING = new Set([
  "customer_cancelled_early",
  "ceaute_error",
]);

function toPence(value) {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.trunc(amount) : 0;
}

// `booking_payment_attempt.ceaute_fee_pence` stores the two components added
// together, because that is what Stripe was sent. Splitting it back apart is
// arithmetic, not a second source of truth: the commission is a known
// percentage of the amount charged and the processing estimate is the rest.
export function splitApplicationFee({
  amountChargedPence,
  applicationFeePence,
  platformFeeBasisPoints = CEAUTE_PLATFORM_FEE_BASIS_POINTS,
}) {
  const amount = Math.max(0, toPence(amountChargedPence));
  const applicationFee = Math.max(0, toPence(applicationFeePence));
  // Clamped because a tiny payment caps the whole application fee, which can
  // leave less than the full commission actually collected.
  const platformFeePence = Math.min(
    applicationFee,
    calculatePlatformFeePence(amount, platformFeeBasisPoints),
  );

  return {
    platformFeePence,
    processingFeePence: applicationFee - platformFeePence,
  };
}

export function isSettlementCause(cause) {
  return SETTLEMENT_CAUSES.includes(String(cause ?? ""));
}

// Works out what the money should look like once a refund has been made, and
// how much of the application fee has to be handed back to get there.
export function decideRefundSettlement({
  amountChargedPence,
  applicationFeePence,
  refundAmountPence,
  cause,
  platformFeeBasisPoints = CEAUTE_PLATFORM_FEE_BASIS_POINTS,
}) {
  if (!isSettlementCause(cause)) {
    throw new Error(`Unknown settlement cause: ${cause}`);
  }

  const amount = Math.max(0, toPence(amountChargedPence));
  const applicationFee = Math.max(
    0,
    Math.min(toPence(applicationFeePence), amount),
  );
  const refund = Math.min(Math.max(0, toPence(refundAmountPence)), amount);
  const { platformFeePence, processingFeePence } = splitApplicationFee({
    amountChargedPence: amount,
    applicationFeePence: applicationFee,
    platformFeeBasisPoints,
  });

  // Whatever the customer does not get back is what the provider's policy let
  // them keep.
  const retainedByProviderPence = amount - refund;
  // The commission is charged on the money the provider actually ends up with,
  // not on the money that briefly passed through. A fully refunded booking
  // earns Ceaute nothing.
  const finalPlatformFeePence = Math.min(
    platformFeePence,
    calculatePlatformFeePence(retainedByProviderPence, platformFeeBasisPoints),
  );

  const ceauteAbsorbsProcessing = CEAUTE_ABSORBS_PROCESSING.has(cause);
  // Stripe never returns its processing fee. Handing that share of the
  // application fee back to the provider is what "Ceaute absorbs it" means in
  // practice; withholding it is what "the provider bears it" means.
  const processingRefundPence = ceauteAbsorbsProcessing
    ? (amount === 0 ? 0 : Math.round((processingFeePence * refund) / amount))
    : 0;

  const applicationFeeRefundPence = Math.min(
    applicationFee,
    Math.max(0, platformFeePence - finalPlatformFeePence) + processingRefundPence,
  );

  return {
    cause,
    amountChargedPence: amount,
    refundAmountPence: refund,
    retainedByProviderPence,
    originalPlatformFeePence: platformFeePence,
    processingFeePence,
    finalPlatformFeePence,
    applicationFeeRefundPence,
    ceauteAbsorbsProcessing,
    providerBearsProcessing: !ceauteAbsorbsProcessing && refund > 0,
  };
}

// The cause, derived from what PostgreSQL already records. `booking.cancelled_by`
// and the cancellation timestamp are the source; nothing is duplicated.
export function describeCancellationCause({
  purpose,
  cancelledBy,
  cancelledLate,
}) {
  // A duplicate or late payment is Ceaute's own payment system putting money
  // where it should not be, so Ceaute carries the whole cost of undoing it.
  if (purpose === "duplicate_payment" || purpose === "late_payment") {
    return "ceaute_error";
  }

  if (cancelledBy === "provider") {
    return "provider_cancelled";
  }

  return cancelledLate ? "customer_cancelled_late" : "customer_cancelled_early";
}

// --- disputes ---------------------------------------------------------------

export const DISPUTE_RESPONSIBILITIES = Object.freeze([
  "undetermined",
  "provider",
  "ceaute",
]);

// What a dispute outcome *should* settle to. Nothing here executes: a lost
// dispute needs money taken back from a provider who may already have been
// paid out, and that recovery mechanism does not exist. The numbers are
// produced so an operator can act on them, and so the provider agreement can
// state them honestly.
export function decideDisputeSettlement({
  amountChargedPence,
  applicationFeePence,
  disputeStatus,
  responsibility = "undetermined",
  platformFeeBasisPoints = CEAUTE_PLATFORM_FEE_BASIS_POINTS,
}) {
  const amount = Math.max(0, toPence(amountChargedPence));
  const { platformFeePence, processingFeePence } = splitApplicationFee({
    amountChargedPence: amount,
    applicationFeePence,
    platformFeeBasisPoints,
  });
  const won = disputeStatus === "won" || disputeStatus === "warning_closed";
  const lost = disputeStatus === "lost";

  if (won) {
    // Nothing reverses. The booking keeps the economics it already had.
    return {
      outcome: "won",
      responsibility,
      platformFeeReturnedPence: 0,
      providerBearsPence: 0,
      ceauteBearsPence: 0,
      requiresManualRecovery: false,
      note: "Normal payment economics stand.",
    };
  }

  if (!lost) {
    return {
      outcome: "open",
      responsibility,
      platformFeeReturnedPence: 0,
      providerBearsPence: 0,
      ceauteBearsPence: 0,
      requiresManualRecovery: false,
      note: "The dispute is not decided yet.",
    };
  }

  if (responsibility === "ceaute") {
    // A duplicate charge, a wrong amount, a payment-system fault: Ceaute's
    // problem entirely, and the provider keeps what they were paid.
    return {
      outcome: "lost",
      responsibility,
      platformFeeReturnedPence: platformFeePence,
      providerBearsPence: 0,
      ceauteBearsPence: amount + processingFeePence,
      requiresManualRecovery: false,
      note: "Ceaute caused the dispute and bears the whole cost.",
    };
  }

  if (responsibility === "provider") {
    // Ceaute does not insure providers against chargebacks. It returns its
    // commission and the disputed amount is the provider's to bear.
    return {
      outcome: "lost",
      responsibility,
      platformFeeReturnedPence: platformFeePence,
      providerBearsPence: amount,
      ceauteBearsPence: processingFeePence,
      requiresManualRecovery: true,
      note: "Recovery from the provider is manual: no automatic debit exists.",
    };
  }

  return {
    outcome: "lost",
    responsibility: "undetermined",
    platformFeeReturnedPence: 0,
    providerBearsPence: 0,
    ceauteBearsPence: amount + processingFeePence,
    requiresManualRecovery: true,
    note: "Responsibility has not been decided, so Ceaute is holding the cost.",
  };
}
