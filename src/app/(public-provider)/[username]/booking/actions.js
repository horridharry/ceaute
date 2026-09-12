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

  const { data: holdId, error } = await supabase.schema("ceaute").rpc(
    "create_booking_hold",
    {
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

  const [
    providerPageResult,
    paymentAccountResult,
    existingAttemptResult,
  ] = await Promise.all([
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
    supabase
      .schema("ceaute")
      .from("booking_payment_attempt")
      .select("id, payment_status")
      .eq("booking_id", booking.id)
      .maybeSingle(),
  ]);

  if (providerPageResult.error || paymentAccountResult.error || existingAttemptResult.error) {
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

  if (existingAttemptResult.data?.payment_status === "succeeded") {
    redirect(`${returnPath}&booking=${booking.id}`);
  }

  if (
    ["refund_required", "refunded", "refund_failed"].includes(
      existingAttemptResult.data?.payment_status,
    )
  ) {
    redirect(`${returnPath}&payment=unavailable`);
  }

  const paymentAmounts = calculateBookingPaymentAmounts(booking.service_snapshot);

  if (paymentAmounts.amountChargedPence <= 0) {
    throw new Error("The amount due now must be greater than zero.");
  }

  const paymentAttemptPayload = {
    booking_id: booking.id,
    amount_charged_pence: paymentAmounts.amountChargedPence,
    total_booking_value_pence: paymentAmounts.totalBookingValuePence,
    amount_due_later_pence: paymentAmounts.amountDueLaterPence,
    ceaute_fee_pence: paymentAmounts.ceauteFeePence,
    currency: paymentAmounts.currency,
    provider_stripe_account_id: paymentAccount.stripe_account_id,
    payment_status: "created",
    failure_reason: null,
  };

  const { data: paymentAttempt, error: attemptError } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .upsert(paymentAttemptPayload, { onConflict: "booking_id" })
    .select("id")
    .single();

  if (attemptError) {
    throw new Error("Could not record checkout attempt.");
  }

  const headerStore = await headers();
  const origin = getRequestOrigin(headerStore);
  const stripe = getStripe();
  const serviceSnapshot = booking.service_snapshot ?? {};
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
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
      payment_attempt_id: paymentAttempt.id,
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
        payment_attempt_id: paymentAttempt.id,
      },
    },
  });

  const { error: updateError } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .update({
      stripe_checkout_session_id: checkoutSession.id,
      stripe_payment_intent_id:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : null,
      payment_status: "checkout_created",
    })
    .eq("id", paymentAttempt.id);

  if (updateError || !checkoutSession.url) {
    throw new Error("Could not create Stripe checkout.");
  }

  redirect(checkoutSession.url);
}
