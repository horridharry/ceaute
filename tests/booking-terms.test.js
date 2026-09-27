import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  areBookingTermsComplete,
  bookingTermsExample,
  DEPOSIT_KINDS,
  isLegacyBookingSetting,
  maximumPercent,
  parseBookingTermsForm,
  percentOptions,
} from "../src/lib/payments/booking-terms.js";
import { PROVIDER_AGREEMENT_VERSION } from "../src/lib/payments/provider-liability.js";

// Approved 23 September 2026 (docs/decisions/006): 10–100% in 5% steps, a
// deposit up to 90%, no 0%; windows of 12, 24 or 48 hours. Approved 27
// September 2026 (docs/decisions/008): a deposit can instead be a flat amount
// in whole pounds, at least £1, with no maximum.

test("percentages step by 5 from 10%, up to 90% for a deposit and 100% for full payment", () => {
  assert.equal(maximumPercent("deposit"), 90);
  assert.equal(maximumPercent("full"), 100);
  assert.deepEqual(percentOptions("deposit"), [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]);
  assert.equal(percentOptions("full").at(-1), 100);
  assert.equal(percentOptions("full").length, 19);
  assert.ok(!percentOptions("full").includes(0));
});

test("complete terms mirror ceaute.booking_terms_are_complete", () => {
  assert.equal(areBookingTermsComplete({ paymentMode: "deposit", depositPercent: 30, cancellationWindowHours: 24 }), true);
  assert.equal(areBookingTermsComplete({ paymentMode: "full", depositPercent: 100, cancellationWindowHours: 48 }), true);
  for (const candidate of [
    { paymentMode: "deposit", depositPercent: 100, cancellationWindowHours: 24 },
    { paymentMode: "deposit", depositPercent: 0, cancellationWindowHours: 24 },
    { paymentMode: "deposit", depositPercent: 33, cancellationWindowHours: 24 },
    { paymentMode: "full", depositPercent: null, cancellationWindowHours: 24 },
    { paymentMode: "full", depositPercent: 50, cancellationWindowHours: 36 },
    { paymentMode: "fixed_deposit", depositPercent: 50, cancellationWindowHours: 24 },
  ]) {
    assert.equal(areBookingTermsComplete(candidate), false, JSON.stringify(candidate));
  }
});

test("a flat deposit is complete in whole pounds of at least £1, with no maximum", () => {
  assert.deepEqual(DEPOSIT_KINDS, ["flat", "percentage"]);
  assert.equal(areBookingTermsComplete({ paymentMode: "deposit", depositPercent: null, depositAmountPence: 1500, cancellationWindowHours: 24 }), true);
  assert.equal(areBookingTermsComplete({ paymentMode: "deposit", depositPercent: null, depositAmountPence: 100000, cancellationWindowHours: 24 }), true);
  assert.equal(areBookingTermsComplete({ paymentMode: "deposit", depositPercent: "", depositAmountPence: 100, cancellationWindowHours: 12 }), true);
  for (const candidate of [
    { paymentMode: "deposit", depositPercent: null, depositAmountPence: 1550, cancellationWindowHours: 24 },
    { paymentMode: "deposit", depositPercent: null, depositAmountPence: 50, cancellationWindowHours: 24 },
    { paymentMode: "deposit", depositPercent: null, depositAmountPence: 0, cancellationWindowHours: 24 },
    { paymentMode: "deposit", depositPercent: 30, depositAmountPence: 1500, cancellationWindowHours: 24 },
    { paymentMode: "full", depositPercent: 50, depositAmountPence: 1500, cancellationWindowHours: 24 },
    { paymentMode: "full", depositPercent: null, depositAmountPence: 1500, cancellationWindowHours: 24 },
    { paymentMode: "deposit", depositPercent: null, depositAmountPence: 1500, cancellationWindowHours: 36 },
  ]) {
    assert.equal(areBookingTermsComplete(candidate), false, JSON.stringify(candidate));
  }
});

test("settings saved before percentages are recognised, never converted", () => {
  assert.equal(isLegacyBookingSetting({ payment_mode: "fixed_deposit", deposit_percent: null, commitment_amount_pence: 4500, cancellation_window_hours: 24 }), true);
  assert.equal(isLegacyBookingSetting({ payment_mode: "full", deposit_percent: null, commitment_amount_pence: null, cancellation_window_hours: 24 }), true);
  assert.equal(isLegacyBookingSetting({ payment_mode: "deposit", deposit_percent: 30, commitment_amount_pence: null, cancellation_window_hours: 24 }), false);
  assert.equal(isLegacyBookingSetting(null), false, "no setting yet is not a legacy setting");
  assert.equal(
    isLegacyBookingSetting({ payment_mode: "deposit", deposit_percent: null, deposit_amount_pence: 1500, commitment_amount_pence: null, cancellation_window_hours: 24 }),
    false,
    "a saved flat deposit is current terms",
  );
});

test("the form parser returns values ready to save, with the fixed amount cleared", () => {
  assert.deepEqual(
    parseBookingTermsForm({ paymentMode: "deposit", depositKind: "percentage", depositPercent: "25", cancellationWindowHours: "12", writtenPolicy: "  Be on time.  " }),
    {
      values: {
        payment_mode: "deposit",
        deposit_percent: 25,
        deposit_amount_pence: null,
        cancellation_window_hours: 12,
        written_policy: "Be on time.",
        commitment_amount_pence: null,
      },
    },
  );
  const full = parseBookingTermsForm({ paymentMode: "full", depositPercent: "100%", cancellationWindowHours: "48", writtenPolicy: "" }).values;
  assert.equal(full.written_policy, null);
  assert.equal(full.deposit_amount_pence, null);
});

test("the form parser saves a flat deposit in pence, with no percentage", () => {
  for (const depositAmount of ["15", "£15", " £ 15 "]) {
    assert.deepEqual(
      parseBookingTermsForm({
        paymentMode: "deposit",
        depositKind: "flat",
        depositPercent: "30",
        depositAmount,
        cancellationWindowHours: "24",
        writtenPolicy: "",
      }),
      {
        values: {
          payment_mode: "deposit",
          deposit_percent: null,
          deposit_amount_pence: 1500,
          cancellation_window_hours: 24,
          written_policy: null,
          commitment_amount_pence: null,
        },
      },
      depositAmount,
    );
  }
  for (const depositAmount of ["15.50", "0", "", "abc", "12345678", undefined]) {
    assert.deepEqual(
      parseBookingTermsForm({ paymentMode: "deposit", depositKind: "flat", depositAmount, cancellationWindowHours: "24" }).errors,
      { deposit_amount: "Enter a deposit in whole pounds, at least £1." },
      String(depositAmount),
    );
  }
});

test("a deposit needs a flat amount or a percentage chosen", () => {
  assert.deepEqual(parseBookingTermsForm({ paymentMode: "deposit", depositPercent: "30", cancellationWindowHours: "24" }).errors, {
    deposit_kind: "Choose a flat amount or a percentage.",
  });
  assert.equal(
    parseBookingTermsForm({ paymentMode: "full", depositKind: "flat", depositPercent: "50", depositAmount: "15", cancellationWindowHours: "24" }).values
      .deposit_amount_pence,
    null,
    "full payment ignores a remembered flat amount",
  );
});

test("the form parser reports each problem beside its field", () => {
  assert.deepEqual(parseBookingTermsForm({ paymentMode: "", depositPercent: "", cancellationWindowHours: "36" }).errors, {
    payment_mode: "Choose deposit or full payment.",
    deposit_percent: "Choose a percentage.",
    cancellation_window_hours: "Choose 12, 24 or 48 hours.",
  });
  assert.equal(
    parseBookingTermsForm({ paymentMode: "deposit", depositKind: "percentage", depositPercent: "95", cancellationWindowHours: "24" }).errors.deposit_percent,
    "Choose a deposit between 10% and 90%, in steps of 5%.",
  );
  assert.equal(
    parseBookingTermsForm({ paymentMode: "full", depositPercent: "7", cancellationWindowHours: "24" }).errors.deposit_percent,
    "Choose between 10% and 100%, in steps of 5%.",
  );
  assert.equal(
    parseBookingTermsForm({ paymentMode: "deposit", depositKind: "percentage", depositPercent: "1e2", cancellationWindowHours: "24" }).errors.deposit_percent,
    "Choose a percentage.",
  );
});

test("the £40 example is exact for every allowed percentage", () => {
  for (const mode of ["deposit", "full"]) {
    for (const percent of percentOptions(mode)) {
      const example = bookingTermsExample({ paymentMode: mode, depositPercent: percent });
      assert.ok(Number.isInteger(example.keptPence), `${mode} ${percent}%`);
      assert.equal(example.payNowPence + example.laterPence, 4000);
      assert.equal(example.keptPence + example.refundedPence, example.payNowPence);
    }
  }
  assert.deepEqual(bookingTermsExample({ paymentMode: "deposit", depositPercent: 30 }), {
    pricePence: 4000,
    payNowPence: 1200,
    laterPence: 2800,
    keptPence: 1200,
    refundedPence: 0,
  });
  assert.deepEqual(bookingTermsExample({ paymentMode: "full", depositPercent: 50 }), {
    pricePence: 4000,
    payNowPence: 4000,
    laterPence: 0,
    keptPence: 2000,
    refundedPence: 2000,
  });
  assert.equal(bookingTermsExample({ paymentMode: "deposit", depositPercent: "" }), null);
});

test("the £40 example for a flat deposit keeps the whole deposit and is never more than the price", () => {
  assert.deepEqual(bookingTermsExample({ paymentMode: "deposit", depositKind: "flat", depositPercent: "30", depositAmountPence: 1500 }), {
    pricePence: 4000,
    payNowPence: 1500,
    laterPence: 2500,
    keptPence: 1500,
    refundedPence: 0,
    flatPence: 1500,
  });
  const aboveThePrice = bookingTermsExample({ paymentMode: "deposit", depositKind: "flat", depositAmountPence: 5000 });
  assert.equal(aboveThePrice.payNowPence, 4000);
  assert.equal(aboveThePrice.laterPence, 0);
  assert.equal(aboveThePrice.keptPence, 4000);
  assert.equal(aboveThePrice.flatPence, 5000);
  assert.equal(bookingTermsExample({ paymentMode: "deposit", depositKind: "flat", depositAmountPence: null }), null);
  assert.equal(bookingTermsExample({ paymentMode: "deposit", depositKind: "flat", depositAmountPence: 1550 }), null);
  assert.deepEqual(
    bookingTermsExample({ paymentMode: "deposit", depositKind: "percentage", depositPercent: 30, depositAmountPence: 1500 }),
    bookingTermsExample({ paymentMode: "deposit", depositPercent: 30 }),
    "a remembered flat amount does not change the percentage example",
  );
});

test("the provider agreement version the app checks is the one PostgreSQL requires", () => {
  const migration = readFileSync("supabase/migrations/202609230001_percentage_terms_and_publication_checks.sql", "utf8");
  const sqlVersion = migration.match(/current_provider_agreement_version\(\)[\s\S]*?select '([0-9-]+)'/);
  assert.ok(sqlVersion, "the migration defines the current agreement version");
  assert.equal(PROVIDER_AGREEMENT_VERSION, sqlVersion[1]);
});
