// Ceaute has no pay-later option: in deposit mode the deposit is the whole
// online payment, so it must be greater than £0. PostgreSQL enforces this with
// provider_booking_setting_deposit_is_positive.
export function meetsPositiveDepositRule({ paymentMode, commitmentAmountPence }) {
  return (
    paymentMode !== "fixed_deposit" ||
    (Number.isInteger(commitmentAmountPence) && commitmentAmountPence > 0)
  );
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
  const ceauteFeePence = Math.min(
    amountChargedPence,
    calculateCeauteFeePence({
      amountChargedPence,
      totalBookingValuePence,
    }),
  );

  return {
    amountChargedPence,
    totalBookingValuePence,
    amountDueLaterPence,
    ceauteFeePence,
    currency: "gbp",
  };
}

// Zero today, which means `application_fee_amount` is never sent and the whole
// charge is transferred to the provider. Under destination charges with
// `fees_collector: "application"` (see stripe/recipient-account.js), Stripe's
// processing fee is still debited from the PLATFORM balance — which receives
// nothing. In Test mode that costs nothing and is invisible; in Live it makes
// the platform balance negative on every booking. Settle the fee, or record
// the subsidy as a decision, before Stripe Live is activated. The plumbing for
// a non-zero fee already exists end to end and needs no new code.
export function calculateCeauteFeePence() {
  return 0;
}
