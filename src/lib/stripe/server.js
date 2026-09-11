import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-08-26.preview";
const STRIPE_ACCOUNT_INCLUDE = [
  "configuration.recipient",
  "identity",
  "requirements",
];

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function getStripeAccountInclude() {
  return STRIPE_ACCOUNT_INCLUDE;
}

export function stripeAccountToPaymentAccount(account) {
  const recipient = account.configuration?.recipient;
  const stripeBalance = recipient?.capabilities?.stripe_balance;

  return {
    stripe_account_id: account.id,
    dashboard: account.dashboard ?? "express",
    identity_country: account.identity?.country ?? "GB",
    recipient_applied: Boolean(recipient?.applied),
    stripe_transfers_status:
      stripeBalance?.stripe_transfers?.status ?? null,
    payouts_status: stripeBalance?.payouts?.status ?? null,
    requirements_currently_due:
      account.requirements?.summary?.currently_due ?? [],
    requirements_past_due: account.requirements?.summary?.past_due ?? [],
    requirements_eventually_due:
      account.requirements?.summary?.eventually_due ?? [],
    last_stripe_update_at: new Date().toISOString(),
  };
}

export function isStripeRecipientReady(paymentAccount) {
  return Boolean(
    paymentAccount?.recipient_applied &&
      paymentAccount?.stripe_transfers_status === "active" &&
      paymentAccount?.payouts_status === "active",
  );
}
