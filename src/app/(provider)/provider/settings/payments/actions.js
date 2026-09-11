"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInProvider } from "../../_lib/provider-data";
import {
  classifyStripePaymentAccount,
  getStripe,
  retrieveStripeAccount,
  stripeAccountToPaymentAccount,
} from "@/lib/stripe/server";

async function upsertPaymentAccount({ supabase, providerPageId, account }) {
  const values = {
    provider_page_id: providerPageId,
    ...stripeAccountToPaymentAccount(account),
  };

  const { error } = await supabase
    .schema("ceaute")
    .from("provider_payment_account")
    .upsert(values, { onConflict: "provider_page_id" });

  if (error) {
    throw new Error("Could not save Stripe account status.");
  }

  return values;
}

export async function getPaymentSettings() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/settings/payments",
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

export async function refreshPaymentStatus() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/settings/payments",
  });
  const { data: paymentAccount, error } = await supabase
    .schema("ceaute")
    .from("provider_payment_account")
    .select("stripe_account_id")
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error || !paymentAccount?.stripe_account_id) {
    redirect("/provider/settings/payments");
  }

  const stripe = getStripe();
  const account = await retrieveStripeAccount(
    stripe,
    paymentAccount.stripe_account_id,
  );
  await upsertPaymentAccount({
    supabase,
    providerPageId: providerPage.id,
    account,
  });

  redirect("/provider/settings/payments");
}

export async function startOrResumeOnboarding() {
  const { supabase, providerPage, user } = await getSignedInProvider({
    next: "/provider/settings/payments",
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
    await upsertPaymentAccount({
      supabase,
      providerPageId: providerPage.id,
      account,
    });
  } else {
    const account = await retrieveStripeAccount(stripe, accountId);
    const values = await upsertPaymentAccount({
      supabase,
      providerPageId: providerPage.id,
      account,
    });
    const state = classifyStripePaymentAccount(values);

    if (!state.canCreateOnboardingLink) {
      throw new Error("Stripe onboarding is not currently available.");
    }
  }

  const accountLink = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        refresh_url: `${origin}/provider/settings/payments`,
        return_url: `${origin}/provider/settings/payments?returned=1`,
      },
    },
  });

  redirect(accountLink.url);
}
