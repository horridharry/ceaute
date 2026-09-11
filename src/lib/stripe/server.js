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

export function retrieveStripeAccount(stripe, accountId) {
  return stripe.v2.core.accounts.retrieve(accountId, {
    include: STRIPE_ACCOUNT_INCLUDE,
  });
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

function hasActionableRequirements(paymentAccount) {
  return Boolean(
    paymentAccount?.requirements_currently_due?.length ||
      paymentAccount?.requirements_past_due?.length,
  );
}

function hasRestrictedCapability(paymentAccount) {
  return (
    paymentAccount?.stripe_transfers_status === "restricted" ||
    paymentAccount?.stripe_transfers_status === "unsupported" ||
    paymentAccount?.payouts_status === "restricted" ||
    paymentAccount?.payouts_status === "unsupported"
  );
}

export function classifyStripePaymentAccount(paymentAccount) {
  if (!paymentAccount?.stripe_account_id) {
    return {
      state: "needs_information",
      canCreateOnboardingLink: true,
      message:
        "Complete Stripe-hosted onboarding to receive transferred customer payments and payouts.",
    };
  }

  const actionable = hasActionableRequirements(paymentAccount);
  const ready = Boolean(
    paymentAccount.recipient_applied &&
      paymentAccount.stripe_transfers_status === "active" &&
      paymentAccount.payouts_status === "active",
  );

  if (ready) {
    return {
      state: "ready",
      canCreateOnboardingLink: false,
      message:
        "Your Stripe account can receive transferred customer payments and payouts.",
    };
  }

  if (hasRestrictedCapability(paymentAccount)) {
    return {
      state: "restricted",
      canCreateOnboardingLink: actionable,
      message: actionable
        ? "Stripe needs more information before payments can be enabled."
        : "Stripe has restricted payments for this account. Check Stripe for next steps.",
    };
  }

  if (actionable) {
    return {
      state: "needs_information",
      canCreateOnboardingLink: true,
      message:
        "Stripe needs more information before payments can be enabled.",
    };
  }

  return {
    state: "pending_review",
    canCreateOnboardingLink: false,
    message:
      "Stripe is reviewing your information. Payments will be enabled when Stripe finishes its checks.",
  };
}
