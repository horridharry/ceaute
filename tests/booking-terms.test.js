import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  areBookingTermsComplete,
  bookingTermsExample,
  isLegacyBookingSetting,
  maximumPercent,
  parseBookingTermsForm,
  percentOptions,
} from "../src/lib/payments/booking-terms.js";
import { PROVIDER_AGREEMENT_VERSION } from "../src/lib/payments/provider-liability.js";

// Approved 23 September 2026 (docs/decisions/006): 10–100% in 5% steps, a
// deposit up to 90%, no 0%; windows of 12, 24 or 48 hours.

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

test("settings saved before percentages are recognised, never converted", () => {
  assert.equal(isLegacyBookingSetting({ payment_mode: "fixed_deposit", deposit_percent: null, commitment_amount_pence: 4500, cancellation_window_hours: 24 }), true);
  assert.equal(isLegacyBookingSetting({ payment_mode: "full", deposit_percent: null, commitment_amount_pence: null, cancellation_window_hours: 24 }), true);
  assert.equal(isLegacyBookingSetting({ payment_mode: "deposit", deposit_percent: 30, commitment_amount_pence: null, cancellation_window_hours: 24 }), false);
  assert.equal(isLegacyBookingSetting(null), false, "no setting yet is not a legacy setting");
});

test("the form parser returns values ready to save, with the fixed amount cleared", () => {
  assert.deepEqual(
    parseBookingTermsForm({ paymentMode: "deposit", depositPercent: "25", cancellationWindowHours: "12", writtenPolicy: "  Be on time.  " }),
    {
      values: {
        payment_mode: "deposit",
        deposit_percent: 25,
        cancellation_window_hours: 12,
        written_policy: "Be on time.",
        commitment_amount_pence: null,
      },
    },
  );
  assert.equal(parseBookingTermsForm({ paymentMode: "full", depositPercent: "100%", cancellationWindowHours: "48", writtenPolicy: "" }).values.written_policy, null);
});

test("the form parser reports each problem beside its field", () => {
  assert.deepEqual(parseBookingTermsForm({ paymentMode: "", depositPercent: "", cancellationWindowHours: "36" }).errors, {
    payment_mode: "Choose deposit or full payment.",
    deposit_percent: "Choose a percentage.",
    cancellation_window_hours: "Choose 12, 24 or 48 hours.",
  });
  assert.equal(
    parseBookingTermsForm({ paymentMode: "deposit", depositPercent: "95", cancellationWindowHours: "24" }).errors.deposit_percent,
    "Choose a deposit between 10% and 90%, in steps of 5%.",
  );
  assert.equal(
    parseBookingTermsForm({ paymentMode: "full", depositPercent: "7", cancellationWindowHours: "24" }).errors.deposit_percent,
    "Choose between 10% and 100%, in steps of 5%.",
  );
  assert.equal(parseBookingTermsForm({ paymentMode: "deposit", depositPercent: "1e2", cancellationWindowHours: "24" }).errors.deposit_percent, "Choose a percentage.");
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

test("the provider agreement version the app checks is the one PostgreSQL requires", () => {
  const migration = readFileSync("supabase/migrations/202609230001_percentage_terms_and_publication_checks.sql", "utf8");
  const sqlVersion = migration.match(/current_provider_agreement_version\(\)[\s\S]*?select '([0-9-]+)'/);
  assert.ok(sqlVersion, "the migration defines the current agreement version");
  assert.equal(PROVIDER_AGREEMENT_VERSION, sqlVersion[1]);
});
