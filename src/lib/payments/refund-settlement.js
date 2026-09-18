// Where the money actually ends up when a destination charge is refunded or
// disputed.
//
// This is pure arithmetic over Stripe's documented behaviour. It calls nothing,
// changes no behaviour, and is not on the refund path. It exists because the
// economics of a refund are otherwise invisible until they appear on a real
// Stripe balance: the flags in `buildStripeRefundRequest` decide who absorbs
// Stripe's non-refundable processing fee, and nothing in the codebase said so
// out loud. Encoding it here means a change to those flags shows up as a failing
// assertion rather than as a surprise at the end of the month.
//
// Stripe's behaviour this models, all from its own documentation:
//
//   * a destination charge transfers the full amount to the connected account
//     and collects `application_fee_amount` back to the platform;
//   * the platform's balance is debited for the refund, for Stripe's fees and
//     for disputes, because `fees_collector` and `losses_collector` are both
//     "application";
//   * `reverse_transfer` reverses the transfer proportionally to the refund;
//   * `refund_application_fee` returns the application fee to the connected
//     account, in full on a full refund and pro rata on a partial one;
//   * Stripe's processing fee is never returned, on a refund or a dispute.
//
// Every function returns the NET position of each party across the whole
// lifecycle — charge and refund together — in pence. The four always sum to
// zero, which is asserted in the tests.

// Stripe's published UK dispute fee. Charged per dispute, win or lose, and
// Stripe's Connect terms state it may not be passed to a connected account.
export const STRIPE_UK_DISPUTE_FEE_PENCE = 1500;

function toPence(value) {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.trunc(amount) : 0;
}

// The position immediately after a successful charge, before anything goes
// wrong. The provider is credited the full amount and the application fee is
// collected back, which is why the provider's share is amount - fee.
export function settleBookingCharge({
  amountChargedPence,
  applicationFeePence,
  actualStripeFeePence,
}) {
  const amount = toPence(amountChargedPence);
  const applicationFee = toPence(applicationFeePence);
  const stripeFee = toPence(actualStripeFeePence);

  return {
    customerPence: -amount,
    providerPence: amount - applicationFee,
    ceautePence: applicationFee - stripeFee,
    stripePence: stripeFee,
  };
}

export function settleBookingRefund({
  amountChargedPence,
  applicationFeePence,
  actualStripeFeePence,
  refundAmountPence,
  reverseTransfer = true,
  refundApplicationFee = true,
}) {
  const amount = toPence(amountChargedPence);
  const applicationFee = toPence(applicationFeePence);
  const refund = Math.min(Math.max(0, toPence(refundAmountPence)), amount);
  const charge = settleBookingCharge({
    amountChargedPence: amount,
    applicationFeePence: applicationFee,
    actualStripeFeePence,
  });

  // Stripe reverses and refunds proportionally to the amount refunded.
  const refundedFraction = amount === 0 ? 0 : refund / amount;
  const transferReversalPence = reverseTransfer ? refund : 0;
  const applicationFeeRefundPence = refundApplicationFee
    ? Math.round(applicationFee * refundedFraction)
    : 0;

  return {
    customerPence: charge.customerPence + refund,
    providerPence:
      charge.providerPence - transferReversalPence + applicationFeeRefundPence,
    // Ceaute's balance funds the refund, recovers the reversal, and gives back
    // whatever share of the application fee was refunded.
    ceautePence:
      charge.ceautePence -
      refund +
      transferReversalPence -
      applicationFeeRefundPence,
    // Stripe keeps the processing fee whatever happens.
    stripePence: charge.stripePence,
    transferReversalPence,
    applicationFeeRefundPence,
  };
}

// A dispute is not a refund: the card network takes the money back, Stripe adds
// its dispute fee, and neither `reverse_transfer` nor `refund_application_fee`
// applies. Nothing in the codebase reverses the transfer, so
// `transferReversedPence` defaults to zero — the provider keeps their share
// unless somebody claws it back by hand.
export function settleBookingDispute({
  amountChargedPence,
  applicationFeePence,
  actualStripeFeePence,
  disputeFeePence = STRIPE_UK_DISPUTE_FEE_PENCE,
  transferReversedPence = 0,
}) {
  const amount = toPence(amountChargedPence);
  const disputeFee = toPence(disputeFeePence);
  const charge = settleBookingCharge({
    amountChargedPence: amount,
    applicationFeePence,
    actualStripeFeePence,
  });
  const reversed = Math.min(
    Math.max(0, toPence(transferReversedPence)),
    Math.max(0, charge.providerPence),
  );

  return {
    customerPence: charge.customerPence + amount,
    providerPence: charge.providerPence - reversed,
    ceautePence: charge.ceautePence - amount - disputeFee + reversed,
    stripePence: charge.stripePence + disputeFee,
    transferReversalPence: reversed,
  };
}

// True when a settlement leaves Ceaute out of pocket. The point of the 2% is to
// be a margin; any scenario where this is false is one Ceaute is subsidising.
export function ceauteIsOutOfPocket(settlement) {
  return toPence(settlement?.ceautePence) < 0;
}
