const PAYMENTS_PATH = "/dashboard/settings/payments";

// Stripe persists these URLs on the single-use Account Link. Keeping the
// payload construction pure lets tests prove the exact values sent to Stripe,
// independently of the Server Action and SDK.
export function buildRecipientOnboardingAccountLink({ accountId, origin }) {
  return {
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        refresh_url: `${origin}${PAYMENTS_PATH}`,
        return_url: `${origin}${PAYMENTS_PATH}?returned=1`,
      },
    },
  };
}
