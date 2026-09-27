// A provider's booking terms: Full payment or Deposit, and a cancellation
// window. A deposit is either a flat amount in whole pounds (at least £1, one
// amount for the whole business) or a percentage; full payment keeps a
// percentage for late cancellation (docs/decisions/006-percentage-booking-terms.md
// and docs/decisions/008-flat-deposit.md).
//
// PostgreSQL owns the rules. ceaute.booking_terms_are_complete decides what a
// complete setting is (and a table check refuses anything else), and
// ceaute.booking_payment_terms is the only place a deposit or percentage is
// turned into pence. This module validates the form for early feedback and
// describes the terms in words; it never rounds a percentage of a real price.

export const BOOKING_PAYMENT_MODES = Object.freeze(["deposit", "full"]);
export const CANCELLATION_WINDOW_HOURS = Object.freeze([12, 24, 48]);
export const DEPOSIT_KINDS = Object.freeze(["flat", "percentage"]);

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

function isAbsent(value) {
  return value === null || value === undefined || value === "";
}

// Mirrors ceaute.booking_terms_are_complete, for the screens only: a
// percentage (full payment or deposit) with no flat amount, or a flat deposit
// of whole pounds, at least £1, with no percentage. There is no maximum.
export function areBookingTermsComplete({
  paymentMode,
  depositPercent,
  depositAmountPence,
  cancellationWindowHours,
}) {
  if (!CANCELLATION_WINDOW_HOURS.includes(Number(cancellationWindowHours))) {
    return false;
  }

  const hasPercent = !isAbsent(depositPercent);
  const hasAmount = !isAbsent(depositAmountPence);

  if ((paymentMode === "full" || paymentMode === "deposit") && hasPercent && !hasAmount) {
    const percent = Number(depositPercent);
    return Number.isInteger(percent) && percentOptions(paymentMode).includes(percent);
  }

  if (paymentMode === "deposit" && hasAmount && !hasPercent) {
    const amount = Number(depositAmountPence);
    return Number.isInteger(amount) && amount >= 100 && amount % 100 === 0;
  }

  return false;
}

// A saved setting that predates decision 006 (a fixed £ deposit, or a
// percentage never chosen). It is kept exactly as it was and never converted;
// it just no longer counts as complete.
export function isLegacyBookingSetting(setting) {
  if (!setting) {
    return false;
  }

  return !areBookingTermsComplete({
    paymentMode: setting.payment_mode,
    depositPercent: setting.deposit_percent,
    depositAmountPence: setting.deposit_amount_pence,
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

// Whole pounds only, with an optional leading £: "15" and "£15" are 15.
function toWholePounds(value) {
  const text = String(value ?? "").trim().replace(/^£/, "").trim();

  if (!/^\d{1,7}$/.test(text)) {
    return null;
  }

  const pounds = Number(text);
  return pounds >= 1 ? pounds : null;
}

// Returns { values } ready to save, or { errors } keyed by field name.
export function parseBookingTermsForm({
  paymentMode,
  depositKind,
  depositPercent,
  depositAmount,
  cancellationWindowHours,
  writtenPolicy,
}) {
  const mode = String(paymentMode ?? "").trim();
  const kind = String(depositKind ?? "").trim();
  const isDeposit = mode === "deposit";
  const isFlat = isDeposit && kind === "flat";
  const percent = toPercent(depositPercent);
  const pounds = isFlat ? toWholePounds(depositAmount) : null;
  const windowHours = Number(cancellationWindowHours);
  const errors = {};

  if (!BOOKING_PAYMENT_MODES.includes(mode)) {
    errors.payment_mode = "Choose deposit or full payment.";
  }

  if (isDeposit && !DEPOSIT_KINDS.includes(kind)) {
    errors.deposit_kind = "Choose a flat amount or a percentage.";
  }

  if (isFlat) {
    if (pounds === null) {
      errors.deposit_amount = "Enter a deposit in whole pounds, at least £1.";
    }
  } else if (!isDeposit || kind === "percentage") {
    if (percent === null) {
      errors.deposit_percent = "Choose a percentage.";
    } else if (mode && !percentOptions(mode).includes(percent)) {
      errors.deposit_percent =
        mode === "deposit"
          ? "Choose a deposit between 10% and 90%, in steps of 5%."
          : "Choose between 10% and 100%, in steps of 5%.";
    }
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
      deposit_percent: isFlat ? null : percent,
      deposit_amount_pence: isFlat ? pounds * 100 : null,
      cancellation_window_hours: windowHours,
      written_policy: policy || null,
      // Current terms replace the old fixed amount; PostgreSQL refuses both.
      commitment_amount_pence: null,
    },
  };
}

// What the terms mean on a £40.00 booking, for the settings screen.
export function bookingTermsExample({ paymentMode, depositKind, depositPercent, depositAmountPence }) {
  if (paymentMode === "deposit" && depositKind === "flat") {
    if (
      !areBookingTermsComplete({
        paymentMode,
        depositPercent: null,
        depositAmountPence,
        cancellationWindowHours: 24,
      })
    ) {
      return null;
    }

    // A deposit is never more than the price, and a late cancellation keeps
    // all of it. PostgreSQL applies the same rule to real prices.
    const flatPence = Number(depositAmountPence);
    const payNowPence = Math.min(EXAMPLE_PRICE_PENCE, flatPence);

    return {
      pricePence: EXAMPLE_PRICE_PENCE,
      payNowPence,
      laterPence: EXAMPLE_PRICE_PENCE - payNowPence,
      keptPence: payNowPence,
      refundedPence: 0,
      flatPence,
    };
  }

  const percent = Number(depositPercent);

  if (
    isAbsent(depositPercent) ||
    !areBookingTermsComplete({
      paymentMode,
      depositPercent: percent,
      depositAmountPence: null,
      cancellationWindowHours: 24,
    })
  ) {
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
