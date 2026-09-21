import { getSignedInProvider } from "../../_lib/provider-data";
import { classifyStripePaymentAccount } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  PROVIDER_AGREEMENT_VERSION,
  describeProviderRestriction,
} from "@/lib/payments/provider-liability";

const PAYMENTS_PATH = "/dashboard/settings/payments";

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
