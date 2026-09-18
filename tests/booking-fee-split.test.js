import assert from "node:assert/strict";
import test from "node:test";
import {
  CEAUTE_PLATFORM_FEE_BASIS_POINTS,
  STRIPE_UK_STANDARD_FEE,
  calculateBookingFeeSplit,
  calculateBookingPaymentAmounts,
  calculateCeauteFeePence,
  calculatePlatformFeePence,
  estimateStripeProcessingFeePence,
} from "../src/lib/payments/booking-payments.js";

test("the agreed worked example: £10.00 deposit with a 35p Stripe fee", () => {
  // Customer pays £10.00, Ceaute earns 20p, Stripe costs 35p, provider gets
  // £9.45. The published UK standard rate produces exactly the 35p in the
  // example, so no hypothetical model is needed here.
  const split = calculateBookingFeeSplit({ amountChargedPence: 1000 });

  assert.equal(split.platformFeePence, 20);
  assert.equal(split.estimatedStripeFeePence, 35);
  assert.equal(split.applicationFeePence, 55);
  assert.equal(split.providerNetPence, 945);
  assert.equal(split.coversProcessingCost, true);
  assert.equal(split.shortfallPence, 0);
});

test("the application fee carries both deductions, not just Ceaute's margin", () => {
  const split = calculateBookingFeeSplit({ amountChargedPence: 5000 });

  assert.equal(
    split.applicationFeePence,
    split.platformFeePence + split.estimatedStripeFeePence,
  );
  assert.equal(
    split.providerNetPence,
    split.amountChargedPence - split.applicationFeePence,
  );
});

test("Ceaute's expected net is its 2% once Stripe takes its estimated cut", () => {
  for (const amountChargedPence of [500, 1000, 2500, 12345]) {
    const split = calculateBookingFeeSplit({ amountChargedPence });

    assert.equal(
      split.applicationFeePence - split.estimatedStripeFeePence,
      split.platformFeePence,
      `net margin is wrong at ${amountChargedPence}p`,
    );
  }
});

test("a deposit is charged a fee on the deposit only, never the balance", () => {
  // £50 treatment, £10 deposit: the £40 paid to the provider in person never
  // touches Stripe and must not be charged for.
  const amounts = calculateBookingPaymentAmounts({
    payment_mode: "fixed_deposit",
    commitment_amount_pence: 1000,
    total_price_pence: 5000,
  });

  assert.equal(amounts.amountChargedPence, 1000);
  assert.equal(amounts.amountDueLaterPence, 4000);
  assert.equal(amounts.platformFeePence, 20);
  assert.equal(amounts.estimatedStripeFeePence, 35);
  assert.equal(amounts.ceauteFeePence, 55);
  assert.equal(amounts.providerNetPence, 945);
});

test("a full payment is charged a fee on the whole price", () => {
  const amounts = calculateBookingPaymentAmounts({
    payment_mode: "full",
    commitment_amount_pence: 1000,
    total_price_pence: 5000,
  });

  assert.equal(amounts.amountChargedPence, 5000);
  assert.equal(amounts.amountDueLaterPence, 0);
  assert.equal(amounts.platformFeePence, 100); // 2% of £50.00
  assert.equal(amounts.estimatedStripeFeePence, 95); // 1.5% of £50.00 + 20p
  assert.equal(amounts.ceauteFeePence, 195);
  assert.equal(amounts.providerNetPence, 4805);
});

test("the same price splits the same whether it arrives as a deposit or in full", () => {
  const asDeposit = calculateBookingPaymentAmounts({
    payment_mode: "fixed_deposit",
    commitment_amount_pence: 2000,
    total_price_pence: 9000,
  });
  const asFullPayment = calculateBookingPaymentAmounts({
    payment_mode: "full",
    commitment_amount_pence: 2000,
    total_price_pence: 2000,
  });

  assert.equal(asDeposit.ceauteFeePence, asFullPayment.ceauteFeePence);
  assert.equal(asDeposit.providerNetPence, asFullPayment.providerNetPence);
});

test("percentages round half up to the nearest penny", () => {
  // 2% of £3.33 is 6.66p and 2% of £1.25 is 2.5p — both round up.
  assert.equal(calculatePlatformFeePence(333), 7);
  assert.equal(calculatePlatformFeePence(125), 3);
  // 2% of £1.24 is 2.48p, which rounds down.
  assert.equal(calculatePlatformFeePence(124), 2);
  // 1.5% of £3.33 is 4.995p, plus the 20p fixed component.
  assert.equal(estimateStripeProcessingFeePence(333), 25);
});

test("every split is whole pence and never leaves the provider owing money", () => {
  for (let amountChargedPence = 1; amountChargedPence <= 400; amountChargedPence += 1) {
    const split = calculateBookingFeeSplit({ amountChargedPence });

    assert.ok(
      Number.isInteger(split.applicationFeePence),
      `fee is not whole pence at ${amountChargedPence}p`,
    );
    assert.ok(
      split.applicationFeePence >= 0 &&
        split.applicationFeePence < amountChargedPence,
      `fee must stay strictly below the charge at ${amountChargedPence}p`,
    );
    assert.ok(
      split.providerNetPence >= 0,
      `provider net went negative at ${amountChargedPence}p`,
    );
  }
});

test("a payment too small to carry both deductions is capped, not rejected", () => {
  // 10p charged: Ceaute's 2% rounds to 0p and Stripe's estimate is 20p, so the
  // intended 20p cannot be retained from a 10p payment. Stripe's £0.30 minimum
  // charge puts this out of reach in practice; the cap is here so the booking
  // degrades into a small loss for Ceaute rather than failing at Stripe.
  const split = calculateBookingFeeSplit({ amountChargedPence: 10 });

  assert.equal(split.platformFeePence, 0);
  assert.equal(split.estimatedStripeFeePence, 20);
  assert.equal(split.applicationFeePence, 9); // one penny below the charge
  assert.equal(split.providerNetPence, 1);
  assert.equal(split.shortfallPence, 11);
  assert.equal(split.coversProcessingCost, false);
});

test("the fee never equals the charge, because Stripe may reject that", () => {
  // Stripe's application-fee guide requires the fee to be "less than the amount
  // of the charge" while its destination-charge guide says "capped at" it. The
  // split takes the stricter reading.
  for (const amountChargedPence of [1, 5, 20, 25]) {
    const split = calculateBookingFeeSplit({ amountChargedPence });

    assert.ok(
      split.applicationFeePence < amountChargedPence,
      `fee reached the charge at ${amountChargedPence}p`,
    );
    assert.ok(split.providerNetPence >= 1);
  }
});

test("Stripe's £0.30 minimum charge comfortably carries both deductions", () => {
  const split = calculateBookingFeeSplit({ amountChargedPence: 30 });

  assert.equal(split.platformFeePence, 1); // 2% of 30p rounds to 1p
  assert.equal(split.estimatedStripeFeePence, 20); // 1.5% of 30p rounds to 0p
  assert.equal(split.applicationFeePence, 21);
  assert.equal(split.providerNetPence, 9);
  assert.equal(split.coversProcessingCost, true);
});

test("a zero charge costs nothing, so the fixed component is not invented", () => {
  const split = calculateBookingFeeSplit({ amountChargedPence: 0 });

  assert.equal(split.estimatedStripeFeePence, 0);
  assert.equal(split.applicationFeePence, 0);
  assert.equal(split.providerNetPence, 0);
  assert.equal(split.coversProcessingCost, true);
});

test("missing, negative and fractional amounts are treated as whole pence", () => {
  for (const amountChargedPence of [undefined, null, -500, Number.NaN, "nope"]) {
    assert.equal(
      calculateBookingFeeSplit({ amountChargedPence }).applicationFeePence,
      0,
    );
  }

  assert.equal(calculateBookingFeeSplit({}).applicationFeePence, 0);
  // Pence are indivisible; a fractional input is truncated before any maths.
  assert.equal(
    calculateBookingFeeSplit({ amountChargedPence: 1000.9 })
      .applicationFeePence,
    55,
  );
});

test("the fee model is injectable, so a rate change is a parameter not a rewrite", () => {
  const split = calculateBookingFeeSplit({
    amountChargedPence: 1000,
    platformFeeBasisPoints: 500, // 5%
    // Stripe's published international (non-UK, non-EEA) card rate.
    stripeFeeModel: { basisPoints: 315, fixedPence: 20 },
  });

  assert.equal(split.platformFeePence, 50);
  assert.equal(split.estimatedStripeFeePence, 52); // 31.5p + 20p
  assert.equal(split.applicationFeePence, 102);
  assert.equal(split.providerNetPence, 898);
});

test("the published rates are the ones the split actually uses", () => {
  assert.equal(CEAUTE_PLATFORM_FEE_BASIS_POINTS, 200);
  assert.equal(STRIPE_UK_STANDARD_FEE.basisPoints, 150);
  assert.equal(STRIPE_UK_STANDARD_FEE.fixedPence, 20);
});

test("calculateCeauteFeePence still returns the application fee for the RPC", () => {
  // claim_booking_checkout receives this value and rejects anything above the
  // charged amount, so the two must not drift apart.
  assert.equal(calculateCeauteFeePence({ amountChargedPence: 1000 }), 55);
  assert.equal(
    calculateCeauteFeePence({ amountChargedPence: 1000 }),
    calculateBookingFeeSplit({ amountChargedPence: 1000 }).applicationFeePence,
  );
});

test("an unexpectedly expensive card eats the margin, which is the known exposure", () => {
  // Retained at Stripe's UK standard rate, but the customer presents a UK
  // commercial card at 2.8% + 20p. Ceaute keeps the difference — here, a loss.
  const amountChargedPence = 1000;
  const split = calculateBookingFeeSplit({ amountChargedPence });
  const actualStripeFeePence = Math.round((amountChargedPence * 280) / 10_000) + 20;

  assert.equal(split.applicationFeePence, 55);
  assert.equal(actualStripeFeePence, 48);
  assert.equal(split.applicationFeePence - actualStripeFeePence, 7);
  // 7p kept instead of the intended 20p: real, bounded, and absorbed by Ceaute
  // rather than passed to the provider. See decision 004.
  assert.ok(split.applicationFeePence - actualStripeFeePence < split.platformFeePence);
});
