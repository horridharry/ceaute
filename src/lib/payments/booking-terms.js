// A provider's booking terms: Full payment or Deposit, one percentage and a
// cancellation window (docs/decisions/006-percentage-booking-terms.md).
//
// PostgreSQL owns the rules. ceaute.booking_terms_are_complete decides what a
// complete setting is (and a table check refuses anything else), and
// ceaute.booking_payment_terms is the only place a percentage is turned into
// pence. This module validates the form for early feedback and describes the
// terms in words; it never rounds a percentage of a real price.

export const BOOKING_PAYMENT_MODES = Object.freeze(["deposit", "full"]);
export const CANCELLATION_WINDOW_HOURS = Object.freeze([12, 24, 48]);

// The worked example on the settings screen. Every allowed percentage of
// £40.00 is a whole number of pence, so the example is exact without rounding.
export const EXAMPLE_PRICE_PENCE = 4000;

const MINIMUM_PERCENT = 10;
const PERCENT_STEP = 5;

export function maximumPercent(paymentMode) {
  return paymentMode === "deposit" ? 90 : 100;
}

export function percentOptions(paymentMode) {
  const options = [];

  for (let percent = MINIMUM_PERCENT; percent <= maximumPercent(paymentMode); percent += PERCENT_STEP) {
    options.push(percent);
  }

  return options;
}

// Mirrors ceaute.booking_terms_are_complete, for the screens only.
export function areBookingTermsComplete({
  paymentMode,
  depositPercent,
  cancellationWindowHours,
}) {
  const percent = Number(depositPercent);

  return (
    BOOKING_PAYMENT_MODES.includes(paymentMode) &&
    Number.isInteger(percent) &&
    percentOptions(paymentMode).includes(percent) &&
    CANCELLATION_WINDOW_HOURS.includes(Number(cancellationWindowHours))
  );
}

// A saved setting that predates percentage terms (a fixed £ deposit, or a
// percentage never chosen). It is kept exactly as it was and never converted;
// it just no longer counts as complete.
export function isLegacyBookingSetting(setting) {
  if (!setting) {
    return false;
  }

  return !areBookingTermsComplete({
    paymentMode: setting.payment_mode,
    depositPercent: setting.deposit_percent,
    cancellationWindowHours: setting.cancellation_window_hours,
  });
}

function toPercent(value) {
  const text = String(value ?? "").trim().replace(/%$/, "");

  if (!/^\d{1,3}$/.test(text)) {
    return null;
  }

  return Number(text);
}

// Returns { values } ready to save, or { errors } keyed by field name.
export function parseBookingTermsForm({
  paymentMode,
  depositPercent,
  cancellationWindowHours,
  writtenPolicy,
}) {
  const mode = String(paymentMode ?? "").trim();
  const percent = toPercent(depositPercent);
  const windowHours = Number(cancellationWindowHours);
  const errors = {};

  if (!BOOKING_PAYMENT_MODES.includes(mode)) {
    errors.payment_mode = "Choose deposit or full payment.";
  }

  if (percent === null) {
    errors.deposit_percent = "Choose a percentage.";
  } else if (mode && !percentOptions(mode).includes(percent)) {
    errors.deposit_percent =
      mode === "deposit"
        ? "Choose a deposit between 10% and 90%, in steps of 5%."
        : "Choose between 10% and 100%, in steps of 5%.";
  }

  if (!CANCELLATION_WINDOW_HOURS.includes(windowHours)) {
    errors.cancellation_window_hours = "Choose 12, 24 or 48 hours.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const policy = String(writtenPolicy ?? "").trim();

  return {
    values: {
      payment_mode: mode,
      deposit_percent: percent,
      cancellation_window_hours: windowHours,
      written_policy: policy || null,
      // Percentage terms replace the fixed amount; PostgreSQL refuses both.
      commitment_amount_pence: null,
    },
  };
}

// What the terms mean on a £40.00 booking, for the settings screen.
export function bookingTermsExample({ paymentMode, depositPercent }) {
  const percent = Number(depositPercent);

  if (!areBookingTermsComplete({ paymentMode, depositPercent: percent, cancellationWindowHours: 24 })) {
    return null;
  }

  const percentAmountPence = (EXAMPLE_PRICE_PENCE * percent) / 100;
  const payNowPence = paymentMode === "deposit" ? percentAmountPence : EXAMPLE_PRICE_PENCE;

  return {
    pricePence: EXAMPLE_PRICE_PENCE,
    payNowPence,
    laterPence: EXAMPLE_PRICE_PENCE - payNowPence,
    keptPence: percentAmountPence,
    refundedPence: payNowPence - percentAmountPence,
  };
}
