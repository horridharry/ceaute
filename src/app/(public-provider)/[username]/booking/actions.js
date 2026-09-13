"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { calculateBookingPaymentAmounts } from "@/lib/payments/booking-payments";
import { normalizeUkPhoneNumber } from "@/lib/phone/normalize";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  classifyStripePaymentAccount,
  getStripe,
} from "@/lib/stripe/server";
import { getPublicBookingDetailsPage } from "../_lib/public-provider-data";
import { normalizePublicUsername } from "../_lib/public-provider-format";

const BOOKING_TIME_COOKIE = "ceaute_booking_time";

export async function storeSelectedBookingTime(startAt) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: BOOKING_TIME_COOKIE,
    value: String(startAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
}

export async function getSelectedBookingTime() {
  const cookieStore = await cookies();
  return cookieStore.get(BOOKING_TIME_COOKIE)?.value ?? null;
}

export async function updateBookingCustomerDetails(formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    return "Sign in to continue.";
  }

  const customerName = String(formData.get("full_name") ?? "").trim();
  const customerPhone = normalizeUkPhoneNumber(formData.get("phone"));

  if (customerName.length < 2) {
    return "Enter your full name.";
  }

  if (customerName.length > 120) {
    return "Full name must be 120 characters or fewer.";
  }

  if (!customerPhone) {
    return "Enter a valid phone number.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update({
      full_name: customerName,
      phone_e164: customerPhone,
    })
    .eq("id", profileId);

  if (error) {
    return "Could not save your details.";
  }

  return "Saved.";
}

function normalizeAddOnIds(formData) {
  return formData
    .getAll("add_on")
    .map((addOnId) => String(addOnId ?? "").trim())
    .filter(Boolean);
}

function buildDetailsUrl({ username, treatmentId, startAt, addOnIds, holdId }) {
  const searchParams = new URLSearchParams({
    start_at: startAt,
  });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  if (holdId) {
    searchParams.set("hold", holdId);
  }

  return `/@${username}/booking/${treatmentId}/details?${searchParams.toString()}`;
}

async function saveCustomerDetails({ supabase, profileId, formData }) {
  const customerName = String(formData.get("full_name") ?? "").trim();
  const customerPhone = normalizeUkPhoneNumber(formData.get("phone"));

  if (customerName.length < 2) {
    return { error: "Enter your full name." };
  }

  if (customerName.length > 120) {
    return { error: "Full name must be 120 characters or fewer." };
  }

  if (!customerPhone) {
    return { error: "Enter a valid phone number." };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update({
      full_name: customerName,
      phone_e164: customerPhone,
    })
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
  const detailsUrl = buildDetailsUrl({
    username,
    treatmentId,
    startAt: startAtValue,
    addOnIds,
  });

  if (!profileId) {
    redirect(`/sign-in?next=${encodeURIComponent(detailsUrl)}`);
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
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const selectedSlotStillAvailable = availableDates.some((date) =>
    date.slots.some((slot) => slot.start_at === startAt.toISOString()),
  );

  if (!selectedSlotStillAvailable) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
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
      redirect(`/@${providerPage.username}/booking/${treatment.id}`);
    }

    throw new Error("Could not hold that booking time.");
  }

  redirect(
    buildDetailsUrl({
      username: providerPage.username,
      treatmentId: treatment.id,
      startAt: startAt.toISOString(),
      addOnIds: selectedAddOns.map((addOn) => addOn.id),
      holdId,
    }),
  );
}

export async function getBookingHoldSummary(bookingId) {
  const supabase = await createClient();
  const { data: summaries, error } = await supabase.schema("ceaute").rpc(
    "get_booking_hold_summary",
    {
      target_booking_id: bookingId,
    },
  );

  if (error) {
    throw new Error("Could not load booking hold.");
  }

  const summary = summaries?.[0];

  if (!summary) {
    return null;
  }

  // The authenticated RPC must authorize access before this privileged read.
  const paymentSupabase = createServiceRoleClient();
  const { data: paymentAttempt, error: paymentError } = await paymentSupabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .select("payment_status")
    .eq("booking_id", summary.id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new Error("Could not load booking payment status.");
  }

  const serviceSnapshot = { ...summary.service_snapshot };

  if (
    !summary.confirmed_at ||
    !["confirmed", "completed"].includes(summary.status)
  ) {
    for (const field of [
      "address_line_1",
      "address_line_2",
      "city",
      "postcode",
      "access_instructions",
    ]) {
      delete serviceSnapshot[field];
    }
  }

  return {
    ...summary,
    service_snapshot: serviceSnapshot,
    payment_status: paymentAttempt?.payment_status ?? null,
  };
}

function getRequestOrigin(headerStore) {
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Could not determine checkout origin.");
  }

  return `${protocol}://${host}`;
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

  const paymentAmounts = calculateBookingPaymentAmounts(booking.service_snapshot);

  if (paymentAmounts.amountChargedPence <= 0) {
    throw new Error("The amount due now must be greater than zero.");
  }

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
      redirect(`${returnPath}&booking=${booking.id}`);
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

  const headerStore = await headers();
  const origin = getRequestOrigin(headerStore);
  const stripe = getStripe();
  const serviceSnapshot = booking.service_snapshot ?? {};
  let checkoutSession;

  try {
    checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: paymentAmounts.currency,
              unit_amount: paymentAmounts.amountChargedPence,
              product_data: {
                name: `${serviceSnapshot.provider_display_name ?? "Ceaute"} - ${serviceSnapshot.treatment_name ?? "booking"}`,
              },
            },
          },
        ],
        success_url: `${origin}${returnPath}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${returnPath}&checkout=cancelled`,
        metadata: {
          booking_id: booking.id,
          payment_attempt_id: checkoutClaim.payment_attempt_id,
        },
        payment_intent_data: {
          ...(paymentAmounts.ceauteFeePence > 0
            ? { application_fee_amount: paymentAmounts.ceauteFeePence }
            : {}),
          transfer_data: {
            destination: paymentAccount.stripe_account_id,
          },
          metadata: {
            booking_id: booking.id,
            payment_attempt_id: checkoutClaim.payment_attempt_id,
          },
        },
      },
      {
        idempotencyKey: checkoutClaim.checkout_idempotency_key,
      },
    );
  } catch (checkoutError) {
    const { error: releaseError } = await supabase.schema("ceaute").rpc(
      "release_booking_checkout_claim",
      {
        target_payment_attempt_id: checkoutClaim.payment_attempt_id,
        target_claim_token: checkoutClaim.claim_token,
        target_reason:
          checkoutError instanceof Error
            ? checkoutError.message
            : "Stripe Checkout creation failed.",
      },
    );

    if (releaseError) {
      throw new Error("Stripe Checkout failed and its claim could not be released.", {
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
