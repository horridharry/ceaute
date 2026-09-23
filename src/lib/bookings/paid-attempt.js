// The payment attempt that took a booking's money, if any.
//
// A booking can have several attempts: an abandoned Checkout, a failed card,
// then a success. The latest is not necessarily the one that paid, and an
// unpaid hold has none that did, so "Paid online" must never read the latest
// attempt (MVP audit defect: an unpaid hold showed "Paid online £x"). A
// duplicate payment is refunded on its own and is not the booking's money.
export const MONEY_TAKEN_ATTEMPT_STATUSES = new Set([
  "succeeded",
  "refund_required",
  "refunded",
  "refund_failed",
]);

export function selectPaidAttempt(attempts = []) {
  return (
    [...attempts]
      .filter((attempt) => MONEY_TAKEN_ATTEMPT_STATUSES.has(attempt?.payment_status))
      .sort((first, second) => Number(first.attempt_number) - Number(second.attempt_number))[0] ?? null
  );
}
