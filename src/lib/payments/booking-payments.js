// Ceaute has no pay-later option: in deposit mode the deposit is the whole
// online payment, so it must be greater than £0. PostgreSQL enforces this with
// provider_booking_setting_deposit_is_positive.
export function meetsPositiveDepositRule({ paymentMode, commitmentAmountPence }) {
  return (
    paymentMode !== "fixed_deposit" ||
    (Number.isInteger(commitmentAmountPence) && commitmentAmountPence > 0)
  );
}

// --- How a booking payment is split -----------------------------------------
//
// The customer pays the advertised price. The provider bears Stripe's
// processing cost and Ceaute's platform fee, and receives the remainder.
//
// Mechanically there is only one lever: `application_fee_amount` on the
// destination charge, which is the whole amount Stripe holds back from the
// transfer and leaves in Ceaute's balance. Stripe then debits its own
// processing fee from that same balance, because the connected account is
// configured with `fees_collector: "application"` (stripe/recipient-account.js).
//
// So the application fee has to carry BOTH parts, or Ceaute pays Stripe out of
// its own pocket:
//
//     application fee = Ceaute's 2% + Stripe's processing fee
//     provider receives = amount charged - application fee
//     Ceaute keeps = application fee - Stripe's actual fee
//
// £10.00 deposit, Stripe fee 35p: application fee 55p, provider gets £9.45,
// Ceaute's balance nets 20p. That is the intended outcome.
//
// The catch is that **Stripe's actual fee is not knowable when the split is
// set**. With destination charges the transfer is created by Stripe as part of
// the charge, from `transfer_data` fixed at Checkout Session creation, while
// the real fee only appears afterwards on the charge's BalanceTransaction — and
// it depends on the card the customer happens to use. The figures below are
// therefore an *estimate*, and Ceaute's 2% is a margin against it rather than a
// guaranteed net. See docs/decisions/004-providers-bear-stripe-processing-fees.md
// for the exposure and the options for exact recovery.

// Basis points throughout: percentages of pence in floating point drift.
export const CEAUTE_PLATFORM_FEE_BASIS_POINTS = 200; // 2.00%

// Stripe's published standard rate for a UK domestic consumer card. Commercial
// and non-UK cards cost more, and this model does not try to predict which card
// a customer will present — see the decision record.
export const STRIPE_UK_STANDARD_FEE = {
  basisPoints: 150, // 1.50%
  fixedPence: 20,
  label: "UK standard card",
};

function toWholePence(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.trunc(amount);
}

function applyBasisPoints(amountPence, basisPoints) {
  // Round half up to the nearest penny. Stripe does the same, and rounding
  // down would quietly shave Ceaute's margin on every odd amount.
  return Math.round((amountPence * basisPoints) / 10_000);
}

export function calculatePlatformFeePence(
  amountChargedPence,
  basisPoints = CEAUTE_PLATFORM_FEE_BASIS_POINTS,
) {
  return applyBasisPoints(toWholePence(amountChargedPence), basisPoints);
}

// An estimate, never a quote. The fixed component only applies when there is
// something to charge, so a zero charge costs nothing.
export function estimateStripeProcessingFeePence(
  amountChargedPence,
  feeModel = STRIPE_UK_STANDARD_FEE,
) {
  const amount = toWholePence(amountChargedPence);

  if (amount === 0) {
    return 0;
  }

  return applyBasisPoints(amount, feeModel.basisPoints) + feeModel.fixedPence;
}

// The full picture, so screens and the provider agreement can show the two
// deductions separately instead of one opaque number.
export function calculateBookingFeeSplit({
  amountChargedPence,
  platformFeeBasisPoints = CEAUTE_PLATFORM_FEE_BASIS_POINTS,
  stripeFeeModel = STRIPE_UK_STANDARD_FEE,
} = {}) {
  const amount = toWholePence(amountChargedPence);
  const platformFeePence = calculatePlatformFeePence(
    amount,
    platformFeeBasisPoints,
  );
  const estimatedStripeFeePence = estimateStripeProcessingFeePence(
    amount,
    stripeFeeModel,
  );
  const intendedFeePence = platformFeePence + estimatedStripeFeePence;

  // Stripe's two guides disagree: the application-fee guide requires a fee
  // "positive and less than the amount of the charge", while the
  // destination-charge guide says it is "capped at" the charge. Leave a penny
  // rather than find out which is right in production — an oversized fee fails
  // Checkout creation and loses the booking. PostgreSQL rejects anything above
  // the charge too (claim_booking_checkout).
  //
  // In practice this floor is unreachable: Stripe enforces a £0.30 minimum
  // charge in GBP, and 30p comfortably carries both deductions. It exists so a
  // future minimum, or a rate change, degrades into a small loss for Ceaute
  // rather than a failed booking.
  const maximumFeePence = Math.max(0, amount - 1);
  const applicationFeePence = Math.min(maximumFeePence, intendedFeePence);

  return {
    amountChargedPence: amount,
    platformFeePence,
    estimatedStripeFeePence,
    applicationFeePence,
    providerNetPence: amount - applicationFeePence,
    // What could not be retained because the payment was too small.
    shortfallPence: intendedFeePence - applicationFeePence,
    // False when the retained amount cannot even cover the estimated Stripe
    // fee, so Ceaute is out of pocket on this booking before its own margin.
    coversProcessingCost: applicationFeePence >= estimatedStripeFeePence,
  };
}

export function calculateBookingPaymentAmounts(serviceSnapshot) {
  const totalBookingValuePence = Math.max(
    0,
    Number(serviceSnapshot?.total_price_pence ?? 0),
  );
  const commitmentAmountPence = Math.max(
    0,
    Number(serviceSnapshot?.commitment_amount_pence ?? 0),
  );
  const paymentMode = serviceSnapshot?.payment_mode;
  const amountChargedPence =
    paymentMode === "fixed_deposit"
      ? Math.min(commitmentAmountPence, totalBookingValuePence)
      : totalBookingValuePence;
  const amountDueLaterPence = Math.max(
    0,
    totalBookingValuePence - amountChargedPence,
  );
  // Only the amount actually processed through Ceaute is charged a fee. A
  // deposit booking's offline balance never touches Stripe, so it is excluded.
  const split = calculateBookingFeeSplit({ amountChargedPence });

  return {
    amountChargedPence,
    totalBookingValuePence,
    amountDueLaterPence,
    // The `ceaute_fee_pence` column and `application_fee_amount` are the same
    // number: everything Stripe holds back from the transfer, Ceaute's margin
    // and the processing cost together.
    ceauteFeePence: split.applicationFeePence,
    platformFeePence: split.platformFeePence,
    estimatedStripeFeePence: split.estimatedStripeFeePence,
    providerNetPence: split.providerNetPence,
    currency: "gbp",
  };
}

export function calculateCeauteFeePence({ amountChargedPence } = {}) {
  return calculateBookingFeeSplit({ amountChargedPence }).applicationFeePence;
}
