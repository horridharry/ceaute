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

export function calculateCeauteFeePence() {
  return 0;
}
