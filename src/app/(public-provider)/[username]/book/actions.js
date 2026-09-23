"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveRequestOrigin } from "@/lib/app/origin";
import { snapshotAmountDueNowPence } from "@/lib/payments/booking-payments";
import { validatePersonalDetails } from "@/lib/profile/personal-details";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizePublicUsername } from "@/features/storefront/format";
import { getPublicBookingDetailsPage } from "../_lib/public-provider-data";
import { buildReturnPath, buildTimePath } from "./[treatmentId]/checkout/_lib/checkout-paths";
import {
  findOwnOverlappingHold,
  findReusableHold,
  loadOwnedBooking,
  openCheckoutForHold,
  openCheckoutForOwnHold,
} from "@/lib/bookings/checkout-session";

function normalizeAddOnIds(formData) {
  return [...new Set(
    formData
      .getAll("add_on")
      .map((addOnId) => String(addOnId ?? "").trim())
      .filter(Boolean),
  )];
}

function wholePence(value) {
  const amount = Number(value);
  return Number.isInteger(amount) ? amount : null;
}

function reviewPath({ username, treatmentId, startAt, addOnIds }) {
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  return `/@${username}/book/${treatmentId}/checkout?${searchParams.toString()}`;
}

const londonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Only when the customer changed something: the booking snapshots the
// profile, and the Account page edits the same two columns.
async function saveChangedDetails({ supabase, profileId, formData }) {
  if (!formData.has("full_name") && !formData.has("phone")) {
    return {};
  }

  const parsed = validatePersonalDetails({
    fullName: formData.get("full_name"),
    phone: formData.get("phone"),
  });

  if (parsed.errors) {
    return { fieldErrors: parsed.errors };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update(parsed.values)
    .eq("id", profileId);

  if (error) {
    return { formError: "We couldn’t save your details. Try again." };
  }

  return {};
}

// Review and pay → Stripe, in one step (approved 23 September 2026).
//
// 1. Save the contact details if the customer changed them.
// 2. Continue with the customer's own matching live hold, or make a new one
//    (10 minutes; PostgreSQL checks the time, the terms and the provider).
// 3. Check the held amounts equal what Review showed. If the provider changed
//    a price or their terms in between, stop before Stripe and show the new
//    terms on the held page.
// 4. Claim Checkout and send the customer to Stripe.
//
// Returns { status, fieldErrors, formError, holdHref } for anything the
// customer can fix on the Review page; everything else redirects.
export async function continueToPayment(_previousState, formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  const username = normalizePublicUsername(formData.get("username"));
  const treatmentId = String(formData.get("treatment_id") ?? "").trim();
  const startAtValue = String(formData.get("start_at") ?? "").trim();
  const addOnIds = normalizeAddOnIds(formData);
  const expectedDueNowPence = wholePence(formData.get("expected_due_now_pence"));
  const expectedTotalPence = wholePence(formData.get("expected_total_pence"));
  const thisReview = reviewPath({ username, treatmentId, startAt: startAtValue, addOnIds });

  if (!profileId) {
    redirect(`/sign-in?next=${encodeURIComponent(thisReview)}`);
  }

  const details = await saveChangedDetails({ supabase, profileId, formData });

  if (details.fieldErrors || details.formError) {
    return { status: "error", fieldErrors: details.fieldErrors ?? {}, formError: details.formError ?? "" };
  }

  const {
    providerPage,
    treatment,
    selectedAddOns,
    totalDurationMinutes,
    availableDates,
    terms,
  } = await getPublicBookingDetailsPage(username, treatmentId, addOnIds);
  const startAt = new Date(startAtValue);
  const selectedAddOnIds = selectedAddOns.map((addOn) => addOn.id);
  const timePath = (notice) =>
    buildTimePath({
      username: providerPage.username,
      treatmentId: treatment.id,
      addOnIds: selectedAddOnIds,
      date: Number.isNaN(startAt.getTime()) ? "" : londonDate.format(startAt),
      notice,
    });

  if (Number.isNaN(startAt.getTime())) {
    redirect(timePath(""));
  }

  if (!terms?.accepts_new_bookings) {
    return { status: "unavailable", fieldErrors: {}, formError: "" };
  }

  const startAtIso = startAt.toISOString();
  let hold = await findReusableHold({
    profileId,
    providerPageId: providerPage.id,
    treatmentId: treatment.id,
    startAt: startAtIso,
    addOnIds: selectedAddOnIds,
  });

  if (!hold) {
    const stillAvailable = availableDates.some((date) =>
      date.slots.some((slot) => slot.start_at === startAtIso),
    );

    if (!stillAvailable) {
      const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60_000);
      const ownHold = await findOwnOverlappingHold({
        profileId,
        providerPageId: providerPage.id,
        startAt: startAtIso,
        endAt: endAt.toISOString(),
      });

      if (ownHold) {
        // The held page for that booking, where it can be paid for.
        const heldAddOnIds = (ownHold.service_snapshot?.selected_add_ons ?? [])
          .map((addOn) => String(addOn?.id ?? ""))
          .filter(Boolean);

        return {
          status: "own_hold",
          fieldErrors: {},
          formError: "",
          holdHref: buildReturnPath({
            username: providerPage.username,
            treatmentId: ownHold.treatment_id,
            startAt: new Date(ownHold.start_at).toISOString(),
            addOnIds: heldAddOnIds,
            holdId: ownHold.id,
          }),
        };
      }

      redirect(timePath("taken"));
    }

    const service = createServiceRoleClient();
    const { data: holdId, error } = await service.schema("ceaute").rpc("create_validated_booking_hold", {
      target_customer_profile_id: profileId,
      target_provider_page_id: providerPage.id,
      target_treatment_id: treatment.id,
      selected_add_on_ids: selectedAddOnIds,
      requested_start_at: startAtIso,
    });

    if (error) {
      const message = String(error.message ?? "");

      if (message.includes("Provider is not taking bookings")) {
        return { status: "unavailable", fieldErrors: {}, formError: "" };
      }

      if (message.includes("Customer details are incomplete")) {
        return {
          status: "error",
          fieldErrors: {},
          formError: "Add your name and mobile number to book.",
          needsDetails: true,
        };
      }

      // Someone else took the time, or it stopped being bookable: both are a
      // "choose another time", never the error page.
      if (
        error.code === "23P01" ||
        /outside the booking rules|unavailable|blocked|Treatment not available|add-ons are not available/i.test(message)
      ) {
        redirect(timePath("taken"));
      }

      throw new Error("Could not hold that booking time.");
    }

    hold = { id: holdId };
  }

  const { booking } = await loadOwnedBooking({ bookingId: hold.id, profileId });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  const returnPath = buildReturnPath({
    username: providerPage.username,
    treatmentId: treatment.id,
    startAt: startAtIso,
    addOnIds: selectedAddOnIds,
    holdId: booking.id,
  });
  const heldDueNow = snapshotAmountDueNowPence(booking.service_snapshot);
  const heldTotal = wholePence(booking.service_snapshot?.total_price_pence);

  if (
    expectedDueNowPence === null ||
    expectedTotalPence === null ||
    heldDueNow !== expectedDueNowPence ||
    heldTotal !== expectedTotalPence
  ) {
    redirect(`${returnPath}&notice=terms_changed`);
  }

  const origin = resolveRequestOrigin(await headers());
  redirect(await openCheckoutForHold({ bookingId: booking.id, profileId, returnPath, origin }));
}

// "Continue to payment" on the held page: the same claim path, which reuses
// an open Stripe Session. Where Stripe returns to is built from the booking.
export async function resumeCheckout(formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!bookingId) {
    throw new Error("Could not start checkout.");
  }

  if (!profileId) {
    redirect("/sign-in?next=%2Faccount%2Fbookings");
  }

  const origin = resolveRequestOrigin(await headers());
  redirect(await openCheckoutForOwnHold({ bookingId, profileId, origin }));
}
