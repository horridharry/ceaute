// Server-only: opening Stripe Checkout for a customer's own hold, and finding a
// hold the customer can continue with. Used by the booking journey and by My
// bookings; never import it into a client component (it uses the
// service-role client).
//
// Unchanged from the original action: the Checkout request is claimed in
// PostgreSQL before Stripe is called (claim_booking_checkout, with its stored
// payload and idempotency key), an uncertain outcome is recorded rather than
// guessed, and an unusable Session is expired and retired. Two things are new:
//   * Stripe's configuration is checked before the claim, so a missing key no
//     longer holds the time for half an hour (audit defect);
//   * the claim can answer provider_unavailable (the database's own agreement
//     and balance gate).
import { calculateBookingPaymentAmounts } from "@/lib/payments/booking-payments";
import {
  PROVIDER_AGREEMENT_VERSION,
  describeProviderRestriction,
} from "@/lib/payments/provider-liability";
import { heldBookingPath } from "@/lib/bookings/held-booking-path";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  classifyStripePaymentAccount,
  getStripe,
} from "@/lib/stripe/server";

const MONEY_TAKEN_STATUSES = new Set([
  "succeeded",
  "duplicate_paid",
  "refund_required",
  "refunded",
  "refund_failed",
]);

function withState(returnPath, key, value) {
  const separator = returnPath.includes("?") ? "&" : "?";
  return `${returnPath}${separator}${key}=${encodeURIComponent(value)}`;
}

function isDefinitiveStripeCheckoutCreationError(error) {
  const stripeErrorType = error?.type ?? error?.rawType;

  return new Set([
    "StripeInvalidRequestError",
    "StripeAuthenticationError",
    "StripePermissionError",
  ]).has(stripeErrorType);
}

// The customer's own booking, read with the service role after the caller has
// established who the customer is. Anyone else's booking is "not found".
export async function loadOwnedBooking({ bookingId, profileId }) {
  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select(
      "id, customer_profile_id, provider_page_id, treatment_id, status, start_at, end_at, expires_at, service_snapshot",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load booking.");
  }

  if (!booking || booking.customer_profile_id !== profileId) {
    return { supabase, booking: null };
  }

  return { supabase, booking };
}

function sameAddOns(snapshot, addOnIds) {
  const stored = (Array.isArray(snapshot?.selected_add_ons) ? snapshot.selected_add_ons : [])
    .map((addOn) => String(addOn?.id ?? ""))
    .sort();
  const requested = [...new Set(addOnIds.map(String))].sort();

  return stored.length === requested.length && stored.every((id, index) => id === requested[index]);
}

// A hold the customer can simply continue with: theirs, for the same provider,
// treatment, start and exact add-ons, not expired, and with no payment that
// has already been taken or is in a terminal state. Reusing it avoids the
// customer colliding with their own hold after going back from Stripe.
export async function findReusableHold({ profileId, providerPageId, treatmentId, startAt, addOnIds }) {
  const supabase = createServiceRoleClient();
  const { data: holds, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select("id, start_at, expires_at, status, service_snapshot")
    .eq("customer_profile_id", profileId)
    .eq("provider_page_id", providerPageId)
    .eq("treatment_id", treatmentId)
    .eq("status", "awaiting_payment")
    .eq("start_at", startAt)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    throw new Error("Could not check for an existing hold.");
  }

  const candidates = (holds ?? []).filter((hold) => sameAddOns(hold.service_snapshot, addOnIds));

  for (const hold of candidates) {
    const { data: attempts, error: attemptError } = await supabase
      .schema("ceaute")
      .from("booking_payment_attempt")
      .select("payment_status")
      .eq("booking_id", hold.id);

    if (attemptError) {
      throw new Error("Could not check the existing hold's payment.");
    }

    if (!(attempts ?? []).some((attempt) => MONEY_TAKEN_STATUSES.has(attempt.payment_status))) {
      return hold;
    }
  }

  return null;
}

// The customer's own live hold that overlaps a time they are trying to book
// at the same provider (for example after changing add-ons). It is shown to
// them rather than silently redirecting.
export async function findOwnOverlappingHold({ profileId, providerPageId, startAt, endAt }) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select("id, treatment_id, start_at, service_snapshot")
    .eq("customer_profile_id", profileId)
    .eq("provider_page_id", providerPageId)
    .eq("status", "awaiting_payment")
    .gt("expires_at", new Date().toISOString())
    .lt("start_at", endAt)
    .gt("end_at", startAt)
    .limit(1);

  if (error) {
    throw new Error("Could not check for an existing hold.");
  }

  return data?.[0] ?? null;
}

async function retireExpiredUnpersistedCheckout({ supabase, paymentAttemptId, claimToken, checkoutSession, reason }) {
  const { error } = await supabase.schema("ceaute").rpc("retire_unpersisted_booking_checkout", {
    target_payment_attempt_id: paymentAttemptId,
    target_claim_token: claimToken,
    target_stripe_checkout_session_id: checkoutSession.id,
    target_stripe_checkout_expires_at: checkoutSession.expires_at
      ? new Date(checkoutSession.expires_at * 1000).toISOString()
      : null,
    target_reason: reason,
  });

  if (error) {
    throw new Error("Could not retire the unusable Stripe Checkout Session.");
  }
}

async function expireUnpersistedCheckout({ stripe, supabase, paymentAttemptId, claimToken, checkoutSession, reason }) {
  let expiredSession;

  try {
    expiredSession = await stripe.checkout.sessions.expire(checkoutSession.id);
  } catch (expireError) {
    try {
      expiredSession = await stripe.checkout.sessions.retrieve(checkoutSession.id);
    } catch {
      throw new Error(
        "Checkout persistence failed and Stripe Session expiry could not be verified.",
        { cause: expireError },
      );
    }
  }

  if (expiredSession.status !== "expired") {
    throw new Error("Checkout persistence failed while the Stripe Session may still be payable.");
  }

  await retireExpiredUnpersistedCheckout({
    supabase,
    paymentAttemptId,
    claimToken,
    checkoutSession: expiredSession,
    reason,
  });
}

// Where to send the customer next: Stripe Checkout, or back to the held page
// with the reason Checkout could not open (?payment=expired | unavailable |
// processing). Never confirms anything: only the signed webhook does.
export async function openCheckoutForHold({ bookingId, profileId, returnPath, origin }) {
  const { supabase, booking } = await loadOwnedBooking({ bookingId, profileId });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  const expiresAt = new Date(booking.expires_at);

  if (
    booking.status !== "awaiting_payment" ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt <= new Date()
  ) {
    return withState(returnPath, "payment", "expired");
  }

  // Before anything is claimed: a deployment without Stripe must not hold
  // the customer's time for half an hour.
  let stripe;
  try {
    stripe = getStripe();
  } catch (configurationError) {
    console.error("Stripe is not available for Checkout", configurationError?.message);
    return withState(returnPath, "payment", "unavailable");
  }

  const [providerPageResult, paymentAccountResult] = await Promise.all([
    supabase.schema("ceaute").from("provider_page").select("status").eq("id", booking.provider_page_id).maybeSingle(),
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
    return withState(returnPath, "payment", "unavailable");
  }

  const paymentAccount = paymentAccountResult.data;

  if (classifyStripePaymentAccount(paymentAccount).state !== "ready") {
    return withState(returnPath, "payment", "unavailable");
  }

  // A provider who owes Ceaute money, or has not accepted the current
  // agreement, cannot take a payment. PostgreSQL checks the same at the claim;
  // checking here first gives the customer the neutral notice without a
  // round trip that would fail anyway.
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
    return withState(returnPath, "payment", "unavailable");
  }

  // The amounts come from the booking's snapshot, which PostgreSQL wrote when
  // the hold was made; claim_booking_checkout refuses anything else.
  const paymentAmounts = calculateBookingPaymentAmounts(booking.service_snapshot);

  if (paymentAmounts.amountChargedPence <= 0) {
    throw new Error("The amount due now must be greater than zero.");
  }

  const successUrl = `${origin}${withState(returnPath, "checkout", "success")}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${withState(returnPath, "checkout", "cancelled")}`;

  const { data: claimResults, error: attemptError } = await supabase.schema("ceaute").rpc("claim_booking_checkout", {
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

  const checkoutClaim = claimResults?.[0];

  if (!checkoutClaim) {
    throw new Error("Could not claim checkout attempt.");
  }

  switch (checkoutClaim.action) {
    case "terminal":
      // Money has already been taken for this booking: never ask again. The
      // held page shows what happened to it.
      return returnPath;
    case "booking_unavailable":
      return withState(returnPath, "payment", "expired");
    case "provider_unavailable":
      return withState(returnPath, "payment", "unavailable");
    case "processing":
      return withState(returnPath, "payment", "processing");
    case "reuse": {
      const checkoutExpiresAt = new Date(checkoutClaim.stripe_checkout_expires_at);

      if (checkoutClaim.stripe_checkout_url && !Number.isNaN(checkoutExpiresAt.getTime()) && checkoutExpiresAt > new Date()) {
        return checkoutClaim.stripe_checkout_url;
      }

      return withState(returnPath, "payment", "expired");
    }
    case "create":
      break;
    default:
      throw new Error("Unexpected checkout claim.");
  }

  let checkoutSession;

  try {
    checkoutSession = await stripe.checkout.sessions.create(checkoutClaim.checkout_request_payload, {
      idempotencyKey: checkoutClaim.checkout_idempotency_key,
    });
  } catch (checkoutError) {
    const rpcName = isDefinitiveStripeCheckoutCreationError(checkoutError)
      ? "reject_booking_checkout_creation"
      : "record_booking_checkout_creation_uncertain";
    const { error: persistenceError } = await supabase.schema("ceaute").rpc(rpcName, {
      target_payment_attempt_id: checkoutClaim.payment_attempt_id,
      target_claim_token: checkoutClaim.claim_token,
      target_reason: checkoutError instanceof Error ? checkoutError.message : "Stripe Checkout creation failed.",
    });

    if (persistenceError) {
      throw new Error("Stripe Checkout failed and its outcome could not be recorded.", { cause: checkoutError });
    }

    // The attempt is recorded (failed, or uncertain and retryable); the held
    // page offers the customer another go.
    console.error("Stripe Checkout creation failed", checkoutError?.type ?? checkoutError?.message);
    return withState(returnPath, "payment", "failed_to_open");
  }

  const stripePaymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;
  const checkoutExpiresAt = checkoutSession.expires_at
    ? new Date(checkoutSession.expires_at * 1000).toISOString()
    : null;

  if (checkoutSession.status !== "open" || !checkoutSession.url || !checkoutExpiresAt) {
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

  const { error: updateError } = await supabase.schema("ceaute").rpc("record_booking_checkout_session", {
    target_payment_attempt_id: checkoutClaim.payment_attempt_id,
    target_claim_token: checkoutClaim.claim_token,
    target_stripe_checkout_session_id: checkoutSession.id,
    target_stripe_payment_intent_id: stripePaymentIntentId ?? null,
    target_stripe_checkout_url: checkoutSession.url,
    target_stripe_checkout_expires_at: checkoutExpiresAt,
  });

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

  return checkoutSession.url;
}

// The held page of one of the customer's own bookings, built from the booking
// itself rather than from anything the browser sent.
export function heldPathForBooking(booking) {
  const snapshot = booking?.service_snapshot ?? {};
  const addOnIds = (Array.isArray(snapshot.selected_add_ons) ? snapshot.selected_add_ons : [])
    .map((addOn) => String(addOn?.id ?? ""))
    .filter(Boolean);

  return heldBookingPath({
    username: snapshot.provider_username,
    treatmentId: booking.treatment_id,
    startAt: new Date(booking.start_at).toISOString(),
    addOnIds,
    holdId: booking.id,
  });
}

// "Continue to payment" for a hold the customer already has (the held page
// and My bookings). Returns where to send them.
export async function openCheckoutForOwnHold({ bookingId, profileId, origin }) {
  const { booking } = await loadOwnedBooking({ bookingId, profileId });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  return openCheckoutForHold({
    bookingId: booking.id,
    profileId,
    returnPath: heldPathForBooking(booking),
    origin,
  });
}
