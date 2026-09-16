"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInProvider } from "../../_lib/provider-data";
import {
  classifyStripePaymentAccount,
  describeStripeError,
  getStripe,
  isStripeError,
  retrieveStripeAccount,
  syncProviderPaymentAccount,
} from "@/lib/stripe/server";

const PAYMENTS_PATH = "/dashboard/settings/payments";

function failure(message) {
  return { error: true, message };
}

function success(message) {
  return { error: false, message };
}

export async function getPaymentSettings() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: PAYMENTS_PATH,
  });

  const { data: paymentAccount, error } = await supabase
    .schema("ceaute")
    .from("provider_payment_account")
    .select(
      "stripe_account_id, dashboard, identity_country, recipient_applied, stripe_transfers_status, payouts_status, requirements_currently_due, requirements_past_due, requirements_eventually_due, last_stripe_update_at",
    )
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load payment settings.");
  }

  return {
    configured: Boolean(process.env.STRIPE_SECRET_KEY),
    paymentAccount,
    state: classifyStripePaymentAccount(paymentAccount),
  };
}

// Stripe is an external dependency that can legitimately be unavailable or
// reject a request. Those outcomes are returned to the payments screen as
// messages; anything that is not a Stripe error keeps propagating so
// programming mistakes still surface as errors.
export async function refreshPaymentStatus() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: PAYMENTS_PATH,
  });
  const { data: paymentAccount, error } = await supabase
    .schema("ceaute")
    .from("provider_payment_account")
    .select("stripe_account_id")
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load Stripe account.");
  }

  if (!paymentAccount?.stripe_account_id) {
    return failure("Connect Stripe before refreshing its status.");
  }

  const stripe = getStripe();
  let account;

  try {
    account = await retrieveStripeAccount(stripe, paymentAccount.stripe_account_id);
  } catch (stripeError) {
    if (!isStripeError(stripeError)) {
      throw stripeError;
    }

    console.error("Stripe account refresh failed", {
      providerPageId: providerPage.id,
      stripeAccountId: paymentAccount.stripe_account_id,
      ...describeStripeError(stripeError),
    });

    return failure(
      "Stripe could not refresh your account status right now. Try again in a few minutes.",
    );
  }

  await syncProviderPaymentAccount({
    providerPageId: providerPage.id,
    account,
  });

  revalidatePath(PAYMENTS_PATH);
  return success("Stripe status refreshed.");
}

export async function startOrResumeOnboarding() {
  const { supabase, providerPage, user } = await getSignedInProvider({
    next: PAYMENTS_PATH,
  });
  const stripe = getStripe();
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin) {
    throw new Error("Could not start Stripe onboarding.");
  }

  const { data: existingAccount, error } = await supabase
    .schema("ceaute")
    .from("provider_payment_account")
    .select("stripe_account_id")
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load Stripe account.");
  }

  let accountId = existingAccount?.stripe_account_id;
  let accountLink;

  try {
    if (!accountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: user.email || undefined,
        display_name: providerPage.business_name || undefined,
        dashboard: "express",
        identity: {
          country: "GB",
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: {
                  requested: true,
                },
              },
            },
          },
        },
        defaults: {
          currency: "gbp",
          locales: ["en-GB"],
          profile: {
            product_description:
              "Beauty appointment services booked through Ceaute.",
          },
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        include: [
          "configuration.recipient",
          "identity",
          "requirements",
        ],
        metadata: {
          provider_page_id: providerPage.id,
        },
      });

      accountId = account.id;
      await syncProviderPaymentAccount({
        providerPageId: providerPage.id,
        account,
      });
    } else {
      const account = await retrieveStripeAccount(stripe, accountId);
      const values = await syncProviderPaymentAccount({
        providerPageId: providerPage.id,
        account,
      });
      const state = classifyStripePaymentAccount(values);

      if (!state.canCreateOnboardingLink) {
        revalidatePath(PAYMENTS_PATH);
        return failure(
          "Stripe onboarding is not currently available for this account.",
        );
      }
    }

    accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: `${origin}${PAYMENTS_PATH}`,
          return_url: `${origin}${PAYMENTS_PATH}?returned=1`,
        },
      },
    });
  } catch (stripeError) {
    if (!isStripeError(stripeError)) {
      throw stripeError;
    }

    console.error("Stripe onboarding could not start", {
      providerPageId: providerPage.id,
      stripeAccountId: accountId ?? null,
      ...describeStripeError(stripeError),
    });

    return failure(
      "Stripe could not start onboarding right now. Try again in a few minutes.",
    );
  }

  redirect(accountLink.url);
}
