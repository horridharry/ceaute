"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveRequestOrigin } from "@/lib/app/origin";
import { calculateBookingPaymentAmounts } from "@/lib/payments/booking-payments";
import {
  PROVIDER_AGREEMENT_VERSION,
  describeProviderRestriction,
} from "@/lib/payments/provider-liability";
import { parsePersonalDetails } from "@/lib/profile/personal-details";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  classifyStripePaymentAccount,
  getStripe,
} from "@/lib/stripe/server";
import { getPublicBookingDetailsPage } from "../_lib/public-provider-data";
import { normalizePublicUsername } from "@/features/storefront/format";
import { buildTreatmentTimeHref } from "@/features/storefront/treatment-selection";

function normalizeAddOnIds(formData) {
  return formData
    .getAll("add_on")
    .map((addOnId) => String(addOnId ?? "").trim())
    .filter(Boolean);
}

function buildCheckoutUrl({ username, treatmentId, startAt, addOnIds, holdId }) {
  const searchParams = new URLSearchParams({
    start_at: startAt,
  });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  if (holdId) {
    searchParams.set("hold", holdId);
  }

  return `/@${username}/book/${treatmentId}/checkout?${searchParams.toString()}`;
}

// The same rule and columns as the account settings screen.
async function saveCustomerDetails({ supabase, profileId, formData }) {
  const parsed = parsePersonalDetails({
    fullName: formData.get("full_name"),
    phone: formData.get("phone"),
  });

  if (parsed.error) {
    return { error: parsed.error };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update(parsed.values)
    .eq("id", profileId);

  if (error) {
    return { error: "Could not save your details." };
  }

  return {};
}

export async function createBookingHoldFromDetails(formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  const username = normalizePublicUsername(formData.get("username"));
  const treatmentId = String(formData.get("treatment_id") ?? "").trim();
  const startAtValue = String(formData.get("start_at") ?? "").trim();
  const addOnIds = normalizeAddOnIds(formData);
  const checkoutUrl = buildCheckoutUrl({
    username,
    treatmentId,
    startAt: startAtValue,
    addOnIds,
  });

  if (!profileId) {
    redirect(`/sign-in?next=${encodeURIComponent(checkoutUrl)}`);
  }

  const detailsResult = await saveCustomerDetails({
    supabase,
    profileId,
    formData,
  });

  if (detailsResult.error) {
    throw new Error(detailsResult.error);
  }

  const {
    providerPage,
    treatment,
    selectedAddOns,
    availableDates,
  } = await getPublicBookingDetailsPage(username, treatmentId, addOnIds);
  const startAt = new Date(startAtValue);

  if (Number.isNaN(startAt.getTime())) {
    redirect(
      buildTreatmentTimeHref({
        username: providerPage.username,
        treatmentId: treatment.id,
        addOnIds: selectedAddOns.map((addOn) => addOn.id),
      }),
    );
  }

  const selectedSlotStillAvailable = availableDates.some((date) =>
    date.slots.some((slot) => slot.start_at === startAt.toISOString()),
  );

  if (!selectedSlotStillAvailable) {
    redirect(
      buildTreatmentTimeHref({
        username: providerPage.username,
        treatmentId: treatment.id,
        addOnIds: selectedAddOns.map((addOn) => addOn.id),
      }),
    );
  }

  const bookingSupabase = createServiceRoleClient();
  const { data: holdId, error } = await bookingSupabase.schema("ceaute").rpc(
    "create_validated_booking_hold",
    {
      target_customer_profile_id: profileId,
      target_provider_page_id: providerPage.id,
      target_treatment_id: treatment.id,
      selected_add_on_ids: selectedAddOns.map((addOn) => addOn.id),
      requested_start_at: startAt.toISOString(),
    },
  );

  if (error) {
    if (error.code === "23P01") {
      redirect(
        buildTreatmentTimeHref({
          username: providerPage.username,
          treatmentId: treatment.id,
          addOnIds: selectedAddOns.map((addOn) => addOn.id),
        }),
      );
    }

    throw new Error("Could not hold that booking time.");
  }

  redirect(
    buildCheckoutUrl({
      username: providerPage.username,
      treatmentId: treatment.id,
      startAt: startAt.toISOString(),
      addOnIds: selectedAddOns.map((addOn) => addOn.id),
      holdId,
    }),
  );
}

function isDefinitiveStripeCheckoutCreationError(error) {
  const stripeErrorType = error?.type ?? error?.rawType;

  return new Set([
    "StripeInvalidRequestError",
    "StripeAuthenticationError",
    "StripePermissionError",
  ]).has(stripeErrorType);
}

async function retireExpiredUnpersistedCheckout({
  supabase,
  paymentAttemptId,
  claimToken,
  checkoutSession,
  reason,
}) {
  const { error } = await supabase.schema("ceaute").rpc(
    "retire_unpersisted_booking_checkout",
    {
      target_payment_attempt_id: paymentAttemptId,
      target_claim_token: claimToken,
      target_stripe_checkout_session_id: checkoutSession.id,
      target_stripe_checkout_expires_at: checkoutSession.expires_at
        ? new Date(checkoutSession.expires_at * 1000).toISOString()
        : null,
      target_reason: reason,
    },
  );

  if (error) {
    throw new Error("Could not retire the unusable Stripe Checkout Session.");
  }
}

async function expireUnpersistedCheckout({
  stripe,
  supabase,
  paymentAttemptId,
  claimToken,
  checkoutSession,
  reason,
}) {
  let expiredSession;

  try {
    expiredSession = await stripe.checkout.sessions.expire(checkoutSession.id);
  } catch (expireError) {
    try {
      expiredSession = await stripe.checkout.sessions.retrieve(
        checkoutSession.id,
      );
    } catch {
      throw new Error(
        "Checkout persistence failed and Stripe Session expiry could not be verified.",
        { cause: expireError },
      );
    }
  }

  if (expiredSession.status !== "expired") {
    throw new Error(
      "Checkout persistence failed while the Stripe Session may still be payable.",
    );
  }

  await retireExpiredUnpersistedCheckout({
    supabase,
    paymentAttemptId,
    claimToken,
    checkoutSession: expiredSession,
    reason,
  });
}

async function getOwnedHeldBooking({ bookingId, profileId }) {
  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select(
      "id, customer_profile_id, provider_page_id, status, expires_at, service_snapshot",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load booking.");
  }

  if (!booking || booking.customer_profile_id !== profileId) {
    throw new Error("Booking not found.");
  }

  return { supabase, booking };
}

export async function startStripeCheckoutForBooking(formData) {
  const authSupabase = await createClient();
  const { data } = await authSupabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    throw new Error("Sign in to continue.");
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const returnPath = String(formData.get("return_path") ?? "").trim();

  if (!bookingId || !returnPath.startsWith("/@")) {
    throw new Error("Could not start checkout.");
  }

  const { supabase, booking } = await getOwnedHeldBooking({
    bookingId,
    profileId,
  });
  const expiresAt = new Date(booking.expires_at);

  if (
    booking.status !== "awaiting_payment" ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt <= new Date()
  ) {
    redirect(`${returnPath}&payment=expired`);
  }

  const [providerPageResult, paymentAccountResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("provider_page")
      .select("status")
      .eq("id", booking.provider_page_id)
      .maybeSingle(),
    supabase
      .schema("ceaute")
      .from("provider_payment_account")
      .select(
        "stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status, requirements_currently_due, requirements_past_due",
      )
      .eq("provider_page_id", booking.provider_page_id)
      .maybeSingle(),
  ]);

  if (providerPageResult.error || paymentAccountResult.error) {
    throw new Error("Could not prepare checkout.");
  }

  if (providerPageResult.data?.status !== "published") {
    redirect(`${returnPath}&payment=unavailable`);
  }

  const paymentAccount = paymentAccountResult.data;
  const paymentState = classifyStripePaymentAccount(paymentAccount);

  if (paymentState.state !== "ready") {
    redirect(`${returnPath}&payment=unavailable`);
  }

  // A provider who already owes Ceaute money, or who has not accepted the
  // current agreement, must not be able to create more financial exposure.
  // This sits beside the Stripe-readiness gate above because it answers the
  // same question — may this provider take a paid booking — and the customer
  // gets the same neutral "cannot take online payments right now" notice
  // either way. The provider's financial state is not the customer's business.
  const { data: standingRows, error: standingError } = await supabase
    .schema("ceaute")
    .rpc("get_provider_financial_standing", {
      target_provider_page_id: booking.provider_page_id,
      required_agreement_version: PROVIDER_AGREEMENT_VERSION,
    });

  if (standingError) {
    throw new Error("Could not prepare checkout.");
  }

  const standing = standingRows?.[0];
  const restriction = describeProviderRestriction({
    outstandingPence: standing?.out_outstanding_pence ?? 0,
    acceptedAgreementVersion: standing?.out_accepted_agreement_version ?? null,
  });

  if (restriction.restricted) {
    redirect(`${returnPath}&payment=unavailable`);
  }

  const paymentAmounts = calculateBookingPaymentAmounts(booking.service_snapshot);

  if (paymentAmounts.amountChargedPence <= 0) {
    throw new Error("The amount due now must be greater than zero.");
  }

  const headerStore = await headers();
  const origin = resolveRequestOrigin(headerStore);
  const successUrl = `${origin}${returnPath}&checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${returnPath}&checkout=cancelled`;

  const { data: claimResults, error: attemptError } = await supabase
    .schema("ceaute")
    .rpc("claim_booking_checkout", {
      target_booking_id: booking.id,
      target_amount_charged_pence: paymentAmounts.amountChargedPence,
      target_total_booking_value_pence: paymentAmounts.totalBookingValuePence,
      target_amount_due_later_pence: paymentAmounts.amountDueLaterPence,
      target_ceaute_fee_pence: paymentAmounts.ceauteFeePence,
      target_currency: paymentAmounts.currency,
      target_provider_stripe_account_id: paymentAccount.stripe_account_id,
      target_success_url: successUrl,
      target_cancel_url: cancelUrl,
    });

  if (attemptError) {
    throw new Error("Could not record checkout attempt.");
  }

  let checkoutClaim = claimResults?.[0];

  if (!checkoutClaim) {
    throw new Error("Could not claim checkout attempt.");
  }

  if (checkoutClaim.action === "terminal") {
    if (checkoutClaim.payment_status === "succeeded") {
      redirect(`${returnPath}&hold=${booking.id}`);
    }

    redirect(`${returnPath}&payment=unavailable`);
  }

  if (checkoutClaim.action === "booking_unavailable") {
    redirect(`${returnPath}&payment=expired`);
  }

  if (checkoutClaim.action === "processing") {
    redirect(`${returnPath}&payment=processing`);
  }

  if (checkoutClaim.action === "reuse") {
    const checkoutExpiresAt = new Date(checkoutClaim.stripe_checkout_expires_at);

    if (
      checkoutClaim.stripe_checkout_url &&
      !Number.isNaN(checkoutExpiresAt.getTime()) &&
      checkoutExpiresAt > new Date()
    ) {
      redirect(checkoutClaim.stripe_checkout_url);
    }

    redirect(`${returnPath}&payment=expired`);
  }

  const stripe = getStripe();
  let checkoutSession;

  try {
    checkoutSession = await stripe.checkout.sessions.create(
      checkoutClaim.checkout_request_payload,
      {
        idempotencyKey: checkoutClaim.checkout_idempotency_key,
      },
    );
  } catch (checkoutError) {
    const rpcName = isDefinitiveStripeCheckoutCreationError(checkoutError)
      ? "reject_booking_checkout_creation"
      : "record_booking_checkout_creation_uncertain";
    const { error: persistenceError } = await supabase.schema("ceaute").rpc(
      rpcName,
      {
        target_payment_attempt_id: checkoutClaim.payment_attempt_id,
        target_claim_token: checkoutClaim.claim_token,
        target_reason:
          checkoutError instanceof Error
            ? checkoutError.message
            : "Stripe Checkout creation failed.",
      },
    );

    if (persistenceError) {
      throw new Error("Stripe Checkout failed and its outcome could not be recorded.", {
        cause: checkoutError,
      });
    }

    throw checkoutError;
  }

  const stripePaymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;
  const checkoutExpiresAt = checkoutSession.expires_at
    ? new Date(checkoutSession.expires_at * 1000).toISOString()
    : null;

  if (
    checkoutSession.status !== "open" ||
    !checkoutSession.url ||
    !checkoutExpiresAt
  ) {
    if (checkoutSession.status === "expired") {
      await retireExpiredUnpersistedCheckout({
        supabase,
        paymentAttemptId: checkoutClaim.payment_attempt_id,
        claimToken: checkoutClaim.claim_token,
        checkoutSession,
        reason: "Stripe Checkout was not returned as an active Session.",
      });
    }

    throw new Error("Stripe Checkout did not return a reusable Session.");
  }

  const { error: updateError } = await supabase.schema("ceaute").rpc(
    "record_booking_checkout_session",
    {
      target_payment_attempt_id: checkoutClaim.payment_attempt_id,
      target_claim_token: checkoutClaim.claim_token,
      target_stripe_checkout_session_id: checkoutSession.id,
      target_stripe_payment_intent_id: stripePaymentIntentId ?? null,
      target_stripe_checkout_url: checkoutSession.url,
      target_stripe_checkout_expires_at: checkoutExpiresAt,
    },
  );

  if (updateError) {
    await expireUnpersistedCheckout({
      stripe,
      supabase,
      paymentAttemptId: checkoutClaim.payment_attempt_id,
      claimToken: checkoutClaim.claim_token,
      checkoutSession,
      reason: updateError.message || "Could not persist Stripe checkout.",
    });
    throw new Error("Could not persist Stripe checkout.");
  }

  redirect(checkoutSession.url);
}
