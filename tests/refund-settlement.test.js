import assert from "node:assert/strict";
import test from "node:test";
import { calculateBookingFeeSplit } from "../src/lib/payments/booking-payments.js";
import {
  STRIPE_UK_DISPUTE_FEE_PENCE,
  ceauteIsOutOfPocket,
  settleBookingCharge,
  settleBookingDispute,
  settleBookingRefund,
} from "../src/lib/payments/refund-settlement.js";

// The agreed worked example throughout: a £50.00 treatment with a £10.00
// deposit. Figures come from the real fee calculation, not hand-typed numbers,
// so a pricing change surfaces here too.
const TREATMENT_PENCE = 5000;
const DEPOSIT_PENCE = 1000;

const deposit = calculateBookingFeeSplit({ amountChargedPence: DEPOSIT_PENCE });
const fullPayment = calculateBookingFeeSplit({
  amountChargedPence: TREATMENT_PENCE,
});

// A UK standard card, which is what the fee estimate assumes.
const depositCharge = {
  amountChargedPence: DEPOSIT_PENCE,
  applicationFeePence: deposit.applicationFeePence,
  actualStripeFeePence: deposit.estimatedStripeFeePence,
};
const fullPaymentCharge = {
  amountChargedPence: TREATMENT_PENCE,
  applicationFeePence: fullPayment.applicationFeePence,
  actualStripeFeePence: fullPayment.estimatedStripeFeePence,
};

function assertBalances(settlement) {
  const total =
    settlement.customerPence +
    settlement.providerPence +
    settlement.ceautePence +
    settlement.stripePence;

  assert.equal(total, 0, `money was created or destroyed: ${total}p`);
}

test("the deposit charge itself: £10.00 in, £9.45 out, 20p margin", () => {
  const settled = settleBookingCharge(depositCharge);

  assert.deepEqual(settled, {
    customerPence: -1000,
    providerPence: 945,
    ceautePence: 20,
    stripePence: 35,
  });
  assertBalances(settled);
});

test("scenario 1 — customer cancels before the deadline: Ceaute absorbs 35p", () => {
  // Full refund of the deposit. The customer is whole and the provider is back
  // to zero, so Stripe's non-refundable processing fee lands on Ceaute.
  const settled = settleBookingRefund({
    ...depositCharge,
    refundAmountPence: DEPOSIT_PENCE,
  });

  assert.equal(settled.customerPence, 0);
  assert.equal(settled.providerPence, 0);
  assert.equal(settled.ceautePence, -35);
  assert.equal(settled.stripePence, 35);
  assert.equal(ceauteIsOutOfPocket(settled), true);
  assertBalances(settled);
});

test("scenario 1, with the other flag: the provider would absorb 55p instead", () => {
  // Not what the code does today. Recorded so the consequence of flipping
  // refund_application_fee is asserted rather than argued about.
  const settled = settleBookingRefund({
    ...depositCharge,
    refundAmountPence: DEPOSIT_PENCE,
    refundApplicationFee: false,
  });

  assert.equal(settled.customerPence, 0);
  assert.equal(settled.providerPence, -55); // Stripe's 35p plus Ceaute's 20p
  assert.equal(settled.ceautePence, 20);
  assert.equal(ceauteIsOutOfPocket(settled), false);
  assertBalances(settled);
});

test("scenario 2 — customer cancels late on a deposit: no refund, nothing moves", () => {
  // The commitment amount equals the deposit, so prepare_booking_cancellation
  // computes a £0 refund and no Stripe call is made at all. This is the only
  // scenario of the four that leaves Ceaute with its intended margin.
  const settled = settleBookingRefund({
    ...depositCharge,
    refundAmountPence: 0,
  });

  assert.equal(settled.customerPence, -1000);
  assert.equal(settled.providerPence, 945);
  assert.equal(settled.ceautePence, 20);
  assert.equal(settled.stripePence, 35);
  assert.equal(ceauteIsOutOfPocket(settled), false);
  assertBalances(settled);
});

test("scenario 2 on a full payment — the partial refund turns Ceaute negative", () => {
  // £50.00 taken up front, £10.00 commitment retained, £40.00 refunded. The
  // application fee comes back pro rata but the processing fee does not come
  // back at all, so Ceaute pays 56p on a booking it was owed £1.00 for.
  const settled = settleBookingRefund({
    ...fullPaymentCharge,
    refundAmountPence: 4000,
  });

  assert.equal(settled.customerPence, -1000); // kept the agreed £10.00
  assert.equal(settled.providerPence, 961);
  assert.equal(settled.ceautePence, -56);
  assert.equal(settled.stripePence, 95);
  assert.equal(ceauteIsOutOfPocket(settled), true);
  assertBalances(settled);
});

function firstLosingRefundPence(charge) {
  for (
    let refundAmountPence = 0;
    refundAmountPence <= charge.amountChargedPence;
    refundAmountPence += 1
  ) {
    if (
      ceauteIsOutOfPocket(settleBookingRefund({ ...charge, refundAmountPence }))
    ) {
      return refundAmountPence;
    }
  }

  return null;
}

test("a partial refund crosses into loss long before the whole booking is refunded", () => {
  // The processing fee is fixed while the retained application fee shrinks with
  // the refund, so Ceaute goes negative at a threshold, not at 100%. The
  // threshold moves with the size of the booking because the 20p fixed part of
  // Stripe's fee matters more on a small one.
  assert.equal(firstLosingRefundPence(depositCharge), 373); // 37.3% of £10.00
  assert.equal(firstLosingRefundPence(fullPaymentCharge), 2577); // 51.5% of £50

  // Both well inside the range a late cancellation actually refunds.
  for (const charge of [depositCharge, fullPaymentCharge]) {
    const threshold = firstLosingRefundPence(charge);

    assert.ok(threshold > 0 && threshold < charge.amountChargedPence);
  }
});

test("scenario 3 — provider cancels: identical economics, Ceaute still pays", () => {
  // A provider cancellation refunds the full online amount, so it settles
  // exactly like scenario 1. Stripe cannot tell the two apart: the refund
  // operation carries no cancelling actor, only booking.cancelled_by does.
  const providerCancellation = settleBookingRefund({
    ...depositCharge,
    refundAmountPence: DEPOSIT_PENCE,
  });
  const customerCancellation = settleBookingRefund({
    ...depositCharge,
    refundAmountPence: DEPOSIT_PENCE,
  });

  assert.deepEqual(providerCancellation, customerCancellation);
  assert.equal(providerCancellation.ceautePence, -35);
  assert.equal(providerCancellation.providerPence, 0);
});

test("scenario 4 — a dispute costs Ceaute £24.80 on a £10.00 deposit", () => {
  // Nothing in the codebase handles a dispute, so no transfer is reversed: the
  // provider keeps £9.45 while Ceaute loses the deposit and the dispute fee.
  const settled = settleBookingDispute(depositCharge);

  assert.equal(settled.customerPence, 0);
  assert.equal(settled.providerPence, 945);
  assert.equal(settled.ceautePence, -2480);
  assert.equal(settled.stripePence, 35 + STRIPE_UK_DISPUTE_FEE_PENCE);
  assert.equal(settled.transferReversalPence, 0);
  assertBalances(settled);
});

test("scenario 4, clawing back everything possible, still costs Ceaute £15.35", () => {
  // Even a perfect manual transfer reversal leaves the dispute fee and the
  // original processing fee with Ceaute — and Stripe's Connect terms forbid
  // passing the dispute fee to a connected account.
  const settled = settleBookingDispute({
    ...depositCharge,
    transferReversedPence: 945,
  });

  assert.equal(settled.providerPence, 0);
  assert.equal(settled.ceautePence, -(STRIPE_UK_DISPUTE_FEE_PENCE + 35));
  assertBalances(settled);
});

test("a dispute fee dwarfs the booking it arrives on", () => {
  // The fee is flat, so the smaller the deposit the worse the ratio. Worth
  // seeing before choosing a minimum deposit.
  const settled = settleBookingDispute(depositCharge);

  assert.ok(Math.abs(settled.ceautePence) > DEPOSIT_PENCE * 2);
});

test("a transfer reversal cannot take back more than the provider received", () => {
  const settled = settleBookingDispute({
    ...depositCharge,
    transferReversedPence: 999_999,
  });

  assert.equal(settled.transferReversalPence, 945);
  assert.equal(settled.providerPence, 0);
  assertBalances(settled);
});

test("a refund is capped at the amount charged and never runs backwards", () => {
  for (const refundAmountPence of [-1, 0, 500, 1000, 99_999]) {
    const settled = settleBookingRefund({
      ...depositCharge,
      refundAmountPence,
    });

    assert.ok(settled.customerPence <= 0);
    assert.ok(settled.customerPence >= -DEPOSIT_PENCE);
    assertBalances(settled);
  }
});

test("every settlement balances across a range of amounts and refunds", () => {
  for (const amountChargedPence of [300, 1000, 2500, 5000, 12_345]) {
    const split = calculateBookingFeeSplit({ amountChargedPence });
    const charge = {
      amountChargedPence,
      applicationFeePence: split.applicationFeePence,
      actualStripeFeePence: split.estimatedStripeFeePence,
    };

    for (const refundAmountPence of [0, 1, amountChargedPence]) {
      assertBalances(settleBookingRefund({ ...charge, refundAmountPence }));
    }

    assertBalances(settleBookingDispute(charge));
  }
});

test("an expensive card makes every refund scenario worse, not just the charge", () => {
  // A UK commercial card costs 2.8% + 20p — 48p on £10.00 — against the 55p
  // retained. Ceaute's margin is 7p on the booking and it still funds the
  // whole 48p if the booking is refunded.
  const actualStripeFeePence = Math.round((DEPOSIT_PENCE * 280) / 10_000) + 20;
  const settled = settleBookingRefund({
    ...depositCharge,
    actualStripeFeePence,
    refundAmountPence: DEPOSIT_PENCE,
  });

  assert.equal(actualStripeFeePence, 48);
  assert.equal(settled.ceautePence, -48);
  assert.equal(settled.providerPence, 0);
  assertBalances(settled);
});
