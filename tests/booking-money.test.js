import assert from "node:assert/strict";
import test from "node:test";
import {
  cancellationPreview,
  cancellationView,
  formatDeadline,
  lateCancellationSentence,
  payNowLabel,
  paymentView,
  snapshotPriceLines,
  termsFromQuote,
  termsFromSnapshot,
} from "../src/lib/bookings/booking-money.js";

// The worked examples of Specification §4.3. PostgreSQL computes them
// (ceaute.booking_payment_terms, pinned in percentage_booking_terms.test.sql);
// these snapshots hold its answers, and the screens must read them back
// without rounding anything again.
const EXAMPLES = [
  // id, mode, percent, price, pay now, late kept
  ["E1", "deposit", 30, 4725, 1418, 1418],
  ["E2", "full", 30, 4725, 4725, 1418],
  ["E3", "deposit", 10, 800, 100, 80],
  ["E4", "deposit", 10, 100, 100, 10],
  ["E5", "deposit", 25, 3333, 833, 833],
  ["E6", "deposit", 15, 1230, 185, 185],
  ["E7", "full", 100, 6000, 6000, 6000],
  ["E8", "deposit", 90, 4500, 4050, 4050],
  ["E9", "full", 10, 1995, 1995, 200],
  ["E10", "deposit", 50, 4999, 2500, 2500],
];

const snapshotFor = ([, mode, percent, price, payNow, kept]) => ({
  payment_mode: mode,
  deposit_percent: percent,
  total_price_pence: price,
  amount_due_now_pence: payNow,
  commitment_amount_pence: kept,
  cancellation_window_hours: 24,
});

test("every worked example reads back exactly: pay now, later, kept and refunded", () => {
  const expectedRefund = { E1: 0, E2: 3307, E3: 20, E4: 90, E5: 0, E6: 0, E7: 0, E8: 0, E9: 1795, E10: 0 };

  for (const example of EXAMPLES) {
    const [id, , , price, payNow, kept] = example;
    const terms = termsFromSnapshot(snapshotFor(example));
    assert.equal(terms.dueNowPence, payNow, id);
    assert.equal(terms.dueLaterPence, price - payNow, id);
    assert.equal(terms.lateKeepPence, kept, id);
    assert.equal(terms.lateRefundPence, expectedRefund[id], id);
  }
});

test("the £1 minimum is shown only when it raised the deposit", () => {
  const byId = Object.fromEntries(EXAMPLES.map((example) => [example[0], termsFromSnapshot(snapshotFor(example))]));
  assert.equal(byId.E3.minimumApplied, true);
  assert.equal(byId.E4.minimumApplied, true);
  assert.equal(byId.E1.minimumApplied, false);
  assert.equal(byId.E2.minimumApplied, false, "full payment has no minimum to explain");
  assert.equal(paymentView(byId.E3).dueNow, "£1.00");
  assert.equal(paymentView(byId.E3).dueLater, "£7.00");
  assert.equal(paymentView(byId.E2).dueLater, null);
});

test("the amounts on Review come from PostgreSQL's quote, and there is none for a paused provider", () => {
  const quote = {
    payment_mode: "deposit",
    deposit_percent: 30,
    cancellation_window_hours: 48,
    accepts_new_bookings: true,
    amount_due_now_pence: 1418,
    amount_due_later_pence: 3307,
    late_cancellation_retained_pence: 1418,
  };
  const terms = termsFromQuote(quote, 4725);
  assert.equal(terms.dueNowPence, 1418);
  assert.equal(terms.windowHours, 48);
  assert.equal(payNowLabel(terms), "Deposit to pay now (30%)");
  assert.equal(termsFromQuote({ ...quote, accepts_new_bookings: false }, 4725), null);
  assert.equal(termsFromQuote({ ...quote, amount_due_now_pence: null }, 4725), null);
  assert.equal(termsFromQuote(null, 4725), null);
});

test("the late-cancellation sentence says who keeps what", () => {
  const [e1, e2, , e4] = EXAMPLES.map((example) => termsFromSnapshot(snapshotFor(example)));
  assert.equal(lateCancellationSentence(e1, "Studio Nala"), "Studio Nala keeps your £14.18 deposit.");
  assert.equal(lateCancellationSentence(e2, "Studio Nala"), "Studio Nala keeps 30% (£14.18) and refunds £33.07.");
  assert.equal(lateCancellationSentence(e4, "Studio Nala"), "Studio Nala keeps £0.10 and refunds £0.90.");
  const e7 = termsFromSnapshot(snapshotFor(EXAMPLES[6]));
  assert.equal(lateCancellationSentence(e7, "Studio Nala"), "Studio Nala keeps the full £60.00.");
});

test("bookings made before percentage terms keep the rule they were made under", () => {
  // Old full payment with a blank retained amount: PostgreSQL refunds all of
  // it, so the screen says so (Specification §4.4).
  const blank = termsFromSnapshot({ payment_mode: "full", commitment_amount_pence: null, total_price_pence: 5000 }, { amountPaidPence: 5000 });
  assert.equal(blank.legacy, true);
  assert.equal(blank.lateKeepPence, 0);
  assert.equal(lateCancellationSentence(blank, "Studio Nala"), "you still get back everything you paid.");

  // Old fixed deposit: keeps the stored amount, never more than was paid.
  const fixed = termsFromSnapshot({ payment_mode: "fixed_deposit", commitment_amount_pence: 4500, total_price_pence: 6000 }, { amountPaidPence: 4500 });
  assert.equal(fixed.isDeposit, true);
  assert.equal(fixed.lateKeepPence, 4500);
  assert.equal(fixed.minimumApplied, false);
  const overPaid = termsFromSnapshot({ payment_mode: "fixed_deposit", commitment_amount_pence: 9000, total_price_pence: 6000 }, { amountPaidPence: 6000 });
  assert.equal(overPaid.lateKeepPence, 6000);
});

test("cancelling before the deadline refunds everything; after it, the provider keeps their share", () => {
  const e2 = termsFromSnapshot(snapshotFor(EXAMPLES[1]), { amountPaidPence: 4725 });
  const startAt = "2026-10-20T10:00:00.000Z";
  const early = cancellationPreview(e2, { startAt, providerName: "Studio Nala", now: Date.parse("2026-10-18T10:00:00.000Z") });
  assert.equal(early.late, false);
  assert.equal(early.refundPence, 4725);
  assert.equal(early.confirmLabel, "Cancel and refund £47.25");
  assert.equal(early.description, "You’ll get back £47.25, everything you paid online.");

  const late = cancellationPreview(e2, { startAt, providerName: "Studio Nala", now: Date.parse("2026-10-19T12:00:00.000Z") });
  assert.equal(late.late, true);
  assert.equal(late.keepPence, 1418);
  assert.equal(late.refundPence, 3307);
  assert.equal(late.confirmLabel, "Cancel and refund £33.07");
  assert.match(late.description, /less than 24 hours before your appointment, so Studio Nala keeps £14\.18\. You’ll get back £33\.07\./);

  const e1 = termsFromSnapshot(snapshotFor(EXAMPLES[0]), { amountPaidPence: 1418 });
  const noRefund = cancellationPreview(e1, { startAt, providerName: "Studio Nala", now: Date.parse("2026-10-20T09:00:00.000Z") });
  assert.equal(noRefund.refundPence, 0);
  assert.equal(noRefund.confirmLabel, "Cancel booking", "no refund, so the button promises none");
  assert.match(noRefund.description, /keeps the £14\.18 you paid\. There’s no refund\./);
});

test("the deadline is the start minus the window, in London time", () => {
  assert.equal(formatDeadline("2026-10-20T09:00:00.000Z", 24), "Mon 19 Oct, 10:00 am");
  assert.equal(formatDeadline("2026-10-26T10:00:00.000Z", 48), "Sat 24 Oct, 11:00 am", "the clocks change on 25 October");
  assert.equal(formatDeadline("not a date", 24), "");
  const view = cancellationView(termsFromSnapshot(snapshotFor(EXAMPLES[0])), {
    startAt: "2026-10-20T09:00:00.000Z",
    providerName: "Studio Nala",
    policy: "  ",
  });
  assert.equal(view.policy, null, "a blank written policy is left out");
  assert.equal(view.windowHours, 24);
});

test("a booking's price lines are its treatment and add-ons, adding up to the total", () => {
  const lines = snapshotPriceLines({
    treatment_name: "Gel manicure",
    total_price_pence: 4725,
    selected_add_ons: [{ id: "a1", name: "Nail art", additional_price_pence: 725 }],
  });
  assert.deepEqual(lines, [
    { key: "treatment", label: "Gel manicure", price: "£40.00", addOn: false },
    { key: "add-on-a1", label: "Nail art", price: "£7.25", addOn: true },
  ]);
});
