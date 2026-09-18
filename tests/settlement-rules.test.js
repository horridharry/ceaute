import assert from "node:assert/strict";
import test from "node:test";
import { calculateBookingFeeSplit } from "../src/lib/payments/booking-payments.js";
import {
  decideDisputeSettlement,
  decideRefundSettlement,
  describeCancellationCause,
  splitApplicationFee,
} from "../src/lib/payments/settlement-rules.js";
import { settleBookingRefund } from "../src/lib/payments/refund-settlement.js";

// The canonical example: £10.00 deposit, 20p commission, 35p processing,
// provider receives £9.45.
const DEPOSIT_PENCE = 1000;
const deposit = calculateBookingFeeSplit({ amountChargedPence: DEPOSIT_PENCE });

// A £50.00 full payment, for the partial-refund case.
const FULL_PAYMENT_PENCE = 5000;
const fullPayment = calculateBookingFeeSplit({
  amountChargedPence: FULL_PAYMENT_PENCE,
});

// Applies a decided settlement to the ledger model, so each rule is checked as
// money that actually balances rather than as an intermediate number.
function settle(charge, decision) {
  return settleBookingRefund({
    amountChargedPence: charge.amountChargedPence,
    applicationFeePence: charge.applicationFeePence,
    actualStripeFeePence: charge.estimatedStripeFeePence,
    refundAmountPence: decision.refundAmountPence,
    reverseTransfer: true,
    // The driver sends refund_application_fee: false and refunds this exact
    // amount separately, which is how a partial share becomes expressible.
    refundApplicationFee: false,
  });
}

function withApplicationFeeRefund(settled, decision) {
  return {
    ...settled,
    providerPence: settled.providerPence + decision.applicationFeeRefundPence,
    ceautePence: settled.ceautePence - decision.applicationFeeRefundPence,
  };
}

function assertBalances(settled) {
  const total =
    settled.customerPence +
    settled.providerPence +
    settled.ceautePence +
    settled.stripePence;

  assert.equal(total, 0, `money was created or destroyed: ${total}p`);
}

test("the stored application fee splits back into commission and processing", () => {
  assert.deepEqual(
    splitApplicationFee({
      amountChargedPence: DEPOSIT_PENCE,
      applicationFeePence: deposit.applicationFeePence,
    }),
    { platformFeePence: 20, processingFeePence: 35 },
  );
});

test("1. £10 normal customer cancellation: provider £0, Ceaute absorbs 35p", () => {
  const decision = decideRefundSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    refundAmountPence: DEPOSIT_PENCE,
    cause: "customer_cancelled_early",
  });

  // Ceaute hands back its commission and the processing share it estimated.
  assert.equal(decision.applicationFeeRefundPence, 55);
  assert.equal(decision.finalPlatformFeePence, 0);
  assert.equal(decision.ceauteAbsorbsProcessing, true);

  const settled = withApplicationFeeRefund(settle(deposit, decision), decision);

  assert.equal(settled.customerPence, 0, "customer is made whole");
  assert.equal(settled.providerPence, 0, "provider bears no cost");
  assert.equal(settled.ceautePence, -35, "Ceaute absorbs the processing cost");
  assert.equal(settled.stripePence, 35);
  assertBalances(settled);
});

test("2. £10 late cancellation, whole deposit retained: nothing moves", () => {
  const decision = decideRefundSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    refundAmountPence: 0,
    cause: "customer_cancelled_late",
  });

  assert.equal(decision.retainedByProviderPence, DEPOSIT_PENCE);
  assert.equal(decision.finalPlatformFeePence, 20, "2% of the retained £10.00");
  assert.equal(decision.applicationFeeRefundPence, 0, "nothing is handed back");

  const settled = withApplicationFeeRefund(settle(deposit, decision), decision);

  assert.equal(settled.customerPence, -1000);
  assert.equal(settled.providerPence, 945);
  assert.equal(settled.ceautePence, 20);
  assert.equal(settled.stripePence, 35);
  assertBalances(settled);
});

test("3. partial late refund: commission is 2% of what the provider keeps", () => {
  // £50.00 taken, £10.00 retained under the provider's policy, £40.00 refunded.
  const decision = decideRefundSettlement({
    amountChargedPence: FULL_PAYMENT_PENCE,
    applicationFeePence: fullPayment.applicationFeePence,
    refundAmountPence: 4000,
    cause: "customer_cancelled_late",
  });

  assert.equal(decision.retainedByProviderPence, 1000);
  assert.equal(decision.originalPlatformFeePence, 100, "2% of £50.00 at charge");
  assert.equal(decision.finalPlatformFeePence, 20, "2% of the £10.00 retained");
  // Commission over-collected at charge time is returned; the processing cost
  // is not, because a late cancellation leaves it with the provider.
  assert.equal(decision.applicationFeeRefundPence, 80);

  const settled = withApplicationFeeRefund(
    settle(fullPayment, decision),
    decision,
  );

  assert.equal(settled.customerPence, -1000, "customer loses only the retention");
  assert.equal(settled.providerPence, 885, "£10.00 less 20p commission and 95p processing");
  assert.equal(settled.ceautePence, 20, "exactly 2% of the retained amount");
  assert.equal(settled.stripePence, 95);
  assertBalances(settled);
});

test("4. £10 provider cancellation: the provider bears the processing cost", () => {
  const decision = decideRefundSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    refundAmountPence: DEPOSIT_PENCE,
    cause: "provider_cancelled",
  });

  // Ceaute returns its commission but not the processing cost.
  assert.equal(decision.applicationFeeRefundPence, 20);
  assert.equal(decision.providerBearsProcessing, true);

  const settled = withApplicationFeeRefund(settle(deposit, decision), decision);

  assert.equal(settled.customerPence, 0, "customer is made whole");
  assert.equal(settled.providerPence, -35, "the provider carries Stripe's charge");
  assert.equal(settled.ceautePence, 0, "Ceaute returns its 2% and keeps nothing");
  assert.equal(settled.stripePence, 35);
  assertBalances(settled);
});

test("a Ceaute error leaves the provider whole, like an early cancellation", () => {
  const decision = decideRefundSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    refundAmountPence: DEPOSIT_PENCE,
    cause: "ceaute_error",
  });
  const settled = withApplicationFeeRefund(settle(deposit, decision), decision);

  assert.equal(settled.providerPence, 0);
  assert.equal(settled.ceautePence, -35);
  assertBalances(settled);
});

test("5. dispute won: the booking keeps the economics it already had", () => {
  const settlement = decideDisputeSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    disputeStatus: "won",
    responsibility: "provider",
  });

  assert.equal(settlement.outcome, "won");
  assert.equal(settlement.platformFeeReturnedPence, 0);
  assert.equal(settlement.providerBearsPence, 0);
  assert.equal(settlement.ceauteBearsPence, 0);
  assert.equal(settlement.requiresManualRecovery, false);
});

test("6. dispute lost and the provider is responsible: Ceaute returns its 2%", () => {
  const settlement = decideDisputeSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    disputeStatus: "lost",
    responsibility: "provider",
  });

  assert.equal(settlement.outcome, "lost");
  assert.equal(settlement.platformFeeReturnedPence, 20);
  assert.equal(settlement.providerBearsPence, 1000, "the disputed amount");
  assert.equal(settlement.ceauteBearsPence, 35, "the non-refundable processing");
  // Ceaute does not insure providers, but it also cannot take the money back
  // automatically — there is no debit mechanism.
  assert.equal(settlement.requiresManualRecovery, true);
});

test("7. a Ceaute-caused dispute costs Ceaute everything", () => {
  const settlement = decideDisputeSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    disputeStatus: "lost",
    responsibility: "ceaute",
  });

  assert.equal(settlement.providerBearsPence, 0);
  assert.equal(settlement.ceauteBearsPence, 1035, "the amount and the processing");
  assert.equal(settlement.platformFeeReturnedPence, 20);
  assert.equal(settlement.requiresManualRecovery, false);
});

test("an undecided lost dispute leaves the cost with Ceaute until somebody rules", () => {
  const settlement = decideDisputeSettlement({
    amountChargedPence: DEPOSIT_PENCE,
    applicationFeePence: deposit.applicationFeePence,
    disputeStatus: "lost",
  });

  assert.equal(settlement.responsibility, "undetermined");
  assert.equal(settlement.providerBearsPence, 0);
  assert.equal(settlement.ceauteBearsPence, 1035);
  assert.equal(settlement.requiresManualRecovery, true);
});

test("a lost dispute always allocates the full loss to exactly one side", () => {
  for (const responsibility of ["provider", "ceaute", "undetermined"]) {
    const settlement = decideDisputeSettlement({
      amountChargedPence: DEPOSIT_PENCE,
      applicationFeePence: deposit.applicationFeePence,
      disputeStatus: "lost",
      responsibility,
    });

    assert.equal(
      settlement.providerBearsPence + settlement.ceauteBearsPence,
      DEPOSIT_PENCE + 35,
      `the loss does not add up for ${responsibility}`,
    );
  }
});

test("8. rounding stays in whole pence and follows the retained amount", () => {
  // 2% of £3.33 is 6.66p, which rounds up; of £1.24 it is 2.48p, which rounds
  // down. The commission must track the retention, not the original charge.
  const charge = calculateBookingFeeSplit({ amountChargedPence: 1000 });

  for (const [retained, expectedFinalFee] of [
    [333, 7],
    [124, 2],
    [125, 3],
    [0, 0],
    [1000, 20],
  ]) {
    const decision = decideRefundSettlement({
      amountChargedPence: 1000,
      applicationFeePence: charge.applicationFeePence,
      refundAmountPence: 1000 - retained,
      cause: "customer_cancelled_late",
    });

    assert.equal(decision.finalPlatformFeePence, expectedFinalFee);
    assert.ok(Number.isInteger(decision.applicationFeeRefundPence));
  }
});

test("every decision is whole pence, non-negative, and never exceeds the fee", () => {
  for (let amountChargedPence = 100; amountChargedPence <= 3000; amountChargedPence += 37) {
    const charge = calculateBookingFeeSplit({ amountChargedPence });

    for (const cause of [
      "customer_cancelled_early",
      "customer_cancelled_late",
      "provider_cancelled",
      "ceaute_error",
    ]) {
      for (const refundAmountPence of [0, 1, Math.floor(amountChargedPence / 3), amountChargedPence]) {
        const decision = decideRefundSettlement({
          amountChargedPence,
          applicationFeePence: charge.applicationFeePence,
          refundAmountPence,
          cause,
        });

        assert.ok(Number.isInteger(decision.applicationFeeRefundPence));
        assert.ok(decision.applicationFeeRefundPence >= 0);
        assert.ok(
          decision.applicationFeeRefundPence <= charge.applicationFeePence,
          `refund of the fee exceeded the fee at ${amountChargedPence}p/${cause}`,
        );
        assertBalances(
          withApplicationFeeRefund(settle(charge, decision), decision),
        );
      }
    }
  }
});

test("a full reversal always returns Ceaute's commission, whatever the cause", () => {
  for (const cause of [
    "customer_cancelled_early",
    "customer_cancelled_late",
    "provider_cancelled",
    "ceaute_error",
  ]) {
    const decision = decideRefundSettlement({
      amountChargedPence: DEPOSIT_PENCE,
      applicationFeePence: deposit.applicationFeePence,
      refundAmountPence: DEPOSIT_PENCE,
      cause,
    });

    assert.equal(decision.finalPlatformFeePence, 0, `commission kept on ${cause}`);
    assert.ok(decision.applicationFeeRefundPence >= 20);
  }
});

test("the cause is derived from what PostgreSQL already records", () => {
  assert.equal(
    describeCancellationCause({ purpose: "cancellation", cancelledBy: "provider", cancelledLate: false }),
    "provider_cancelled",
  );
  assert.equal(
    describeCancellationCause({ purpose: "cancellation", cancelledBy: "customer", cancelledLate: true }),
    "customer_cancelled_late",
  );
  assert.equal(
    describeCancellationCause({ purpose: "cancellation", cancelledBy: "customer", cancelledLate: false }),
    "customer_cancelled_early",
  );
  // A provider cancelling after the deadline is still a provider cancellation:
  // the deadline is the customer's, not theirs.
  assert.equal(
    describeCancellationCause({ purpose: "cancellation", cancelledBy: "provider", cancelledLate: true }),
    "provider_cancelled",
  );
  for (const purpose of ["duplicate_payment", "late_payment"]) {
    assert.equal(
      describeCancellationCause({ purpose, cancelledBy: "customer", cancelledLate: true }),
      "ceaute_error",
    );
  }
});

test("an unknown cause is refused rather than settled by guesswork", () => {
  assert.throws(
    () =>
      decideRefundSettlement({
        amountChargedPence: DEPOSIT_PENCE,
        applicationFeePence: 55,
        refundAmountPence: 0,
        cause: "someone_else",
      }),
    /Unknown settlement cause/,
  );
});
