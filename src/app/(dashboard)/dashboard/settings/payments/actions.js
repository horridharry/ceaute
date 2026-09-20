"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getSignedInProvider } from "../../_lib/provider-data";
import { resolveRequestOrigin } from "@/lib/app/origin";
import { captureServerEvent } from "@/lib/posthog-server";
import { buildRecipientOnboardingAccountLink } from "@/lib/stripe/account-link";
import {
  classifyStripePaymentAccount,
  describeStripeError,
  getStripe,
  isStripeError,
  retrieveStripeAccount,
  syncProviderPaymentAccount,
} from "@/lib/stripe/server";
import { buildRecipientAccountParams } from "@/lib/stripe/recipient-account";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  PROVIDER_AGREEMENT_VERSION,
  describeProviderRestriction,
} from "@/lib/payments/provider-liability";

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
    console.error("Failed to load provider payment account:", error);
    throw new Error("Could not load payment settings.");
  }

  // The liability ledger is operator-only, so the amount owed is read with the
  // trusted client. The provider sees that a balance exists and is asked to
  // contact Ceaute; they do not get a self-service view of a debt an operator
  // is still deciding.
  const serviceRole = createServiceRoleClient();
  const { data: standingRows, error: standingError } = await serviceRole
    .schema("ceaute")
    .rpc("get_provider_financial_standing", {
      target_provider_page_id: providerPage.id,
      required_agreement_version: PROVIDER_AGREEMENT_VERSION,
    });

  if (standingError) {
    console.error("Failed to load provider financial standing:", standingError);
    throw new Error("Could not load payment settings.");
  }

  const standing = standingRows?.[0];

  return {
    configured: Boolean(process.env.STRIPE_SECRET_KEY),
    paymentAccount,
    state: classifyStripePaymentAccount(paymentAccount),
    agreementVersion: PROVIDER_AGREEMENT_VERSION,
    agreementAcceptedAt: standing?.out_agreement_accepted_at ?? null,
    restriction: describeProviderRestriction({
      outstandingPence: standing?.out_outstanding_pence ?? 0,
      acceptedAgreementVersion:
        standing?.out_accepted_agreement_version ?? null,
    }),
  };
}

// Records acceptance of the current agreement version. Insert-only: there is
// no update or delete policy on the table, so an acceptance cannot be altered
// afterwards, and accepting a new version adds a row rather than replacing
// one. Re-accepting the same version is a no-op.
export async function acceptProviderAgreement() {
  const { supabase, providerPage, user } = await getSignedInProvider({
    next: PAYMENTS_PATH,
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("provider_agreement_acceptance")
    .insert({
      provider_page_id: providerPage.id,
      agreement_version: PROVIDER_AGREEMENT_VERSION,
      accepted_by_profile_id: user.id,
    });

  // 23505 is the unique violation: this version is already accepted, which is
  // the desired end state rather than an error to show anybody.
  if (error && error.code !== "23505") {
    throw new Error("Could not record agreement acceptance.");
  }

  await captureServerEvent({
    distinctId: user.id,
    event: "provider_agreement_accepted",
    properties: {
      provider_page_id: providerPage.id,
      agreement_version: PROVIDER_AGREEMENT_VERSION,
      already_accepted: error?.code === "23505",
    },
  });

  revalidatePath(PAYMENTS_PATH);
  return success("Provider agreement accepted.");
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
    account = await retrieveStripeAccount(
      stripe,
      paymentAccount.stripe_account_id,
    );
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
  const actionStartedAt = performance.now();
  const timingsMs = {};
  const time = async (name, operation) => {
    const startedAt = performance.now();

    try {
      return await operation();
    } finally {
      timingsMs[name] = Math.round(performance.now() - startedAt);
    }
  };

  const { supabase, providerPage, user } = await time(
    "authenticate_and_load_provider",
    () => getSignedInProvider({ next: PAYMENTS_PATH }),
  );
  const stripe = getStripe();
  // Stripe persists refresh_url and return_url on the Account Link, so they
  // must use the environment's configured canonical origin rather than a
  // generated deployment hostname or a request header a caller controls.
  const requestHeaders = await headers();
  const origin = resolveRequestOrigin(requestHeaders);

  const { data: existingAccount, error } = await time(
    "load_payment_account",
    () =>
      supabase
        .schema("ceaute")
        .from("provider_payment_account")
        .select("stripe_account_id")
        .eq("provider_page_id", providerPage.id)
        .maybeSingle(),
  );

  if (error) {
    throw new Error("Could not load Stripe account.");
  }

  let accountId = existingAccount?.stripe_account_id;
  let accountLink;

  try {
    if (!accountId) {
      const account = await time("create_stripe_account", () =>
        stripe.v2.core.accounts.create(
          buildRecipientAccountParams({
            providerPage,
            contactEmail: user.email,
          }),
        ),
      );

      accountId = account.id;
      await time("sync_payment_account", () =>
        syncProviderPaymentAccount({
          providerPageId: providerPage.id,
          account,
        }),
      );
    } else {
      const account = await time("retrieve_stripe_account", () =>
        retrieveStripeAccount(stripe, accountId),
      );
      const values = await time("sync_payment_account", () =>
        syncProviderPaymentAccount({
          providerPageId: providerPage.id,
          account,
        }),
      );
      const state = classifyStripePaymentAccount(values);

      if (!state.canCreateOnboardingLink) {
        revalidatePath(PAYMENTS_PATH);
        return failure(
          "Stripe onboarding is not currently available for this account.",
        );
      }
    }

    const accountLinkParams = buildRecipientOnboardingAccountLink({
      accountId,
      origin,
    });
    accountLink = await time("create_account_link", () =>
      stripe.v2.core.accountLinks.create(accountLinkParams),
    );

    console.info("Stripe onboarding link prepared", {
      flow: existingAccount?.stripe_account_id ? "resume" : "new",
      refreshUrl:
        accountLinkParams.use_case.account_onboarding.refresh_url,
      returnUrl: accountLinkParams.use_case.account_onboarding.return_url,
      timingsMs,
      totalBeforeRedirectMs: Math.round(performance.now() - actionStartedAt),
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

  // Analytics is not part of creating the Stripe link. Deliver it after the
  // redirect response so PostHog latency cannot keep the button spinning.
  after(() =>
    captureServerEvent({
      distinctId: user.id,
      event: "stripe_onboarding_started",
      properties: {
        provider_page_id: providerPage.id,
        resumed_existing_account: Boolean(existingAccount?.stripe_account_id),
      },
    }),
  );

  redirect(accountLink.url);
}
