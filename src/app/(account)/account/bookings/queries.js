// Read-only loaders for /account/bookings. Booking mutations live in
// ./actions.js.

import {
  describeInspirationImageAllowance,
  listBookingInspirationImages,
} from "@/lib/bookings/booking-inspiration-images";
import {
  bookingToDisplayBooking,
  customerBookingView,
  groupCustomerBookings,
} from "@/lib/bookings/booking-display";
import {
  getHoldDetailsForBookings,
  getPaidPaymentAttemptsForBookings,
} from "@/lib/bookings/booking-payment-attempts";
import { getSignedInCustomer } from "./_lib/customer-session";

// The booking summaries leave out which attempt paid and when a hold ends;
// both are read for the customer's own bookings only, after the authorised
// summary query has returned them.
async function withPaymentAndHold(bookings) {
  const unpaidHoldIds = bookings
    .filter((booking) => booking.status === "awaiting_payment")
    .map((booking) => booking.id);
  const [paidAttempts, holds] = await Promise.all([
    getPaidPaymentAttemptsForBookings(bookings.map((booking) => booking.id)),
    getHoldDetailsForBookings(unpaidHoldIds),
  ]);

  return bookings.map((booking) => {
    const paidAttempt = paidAttempts.get(booking.id) ?? null;
    const hold = holds.get(booking.id) ?? null;

    return {
      ...bookingToDisplayBooking(booking, paidAttempt),
      service_snapshot: booking.service_snapshot ?? {},
      paid_attempt: paidAttempt,
      hold_expires_at: hold?.expires_at ?? null,
      treatment_id: hold?.treatment_id ?? null,
    };
  });
}

export async function getCustomerBookings() {
  const { supabase } = await getSignedInCustomer("/account/bookings");

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .rpc("get_customer_booking_summaries");

  if (error) {
    throw new Error("Could not load customer bookings.");
  }

  return groupCustomerBookings(await withPaymentAndHold(bookings ?? []));
}

export async function getCustomerBooking(bookingId) {
  const { supabase } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .rpc("get_customer_booking_summaries", {
      target_booking_id: bookingId,
    });

  if (error) {
    throw new Error("Could not load customer booking.");
  }

  const booking = bookings?.[0];

  if (!booking) {
    return null;
  }

  const [[displayBooking], reviewResult, inspirationImages] = await Promise.all([
    withPaymentAndHold([booking]),
    supabase
      .schema("ceaute")
      .from("booking_review")
      .select("id, rating, comment, is_visible, created_at")
      .eq("booking_id", booking.id)
      .maybeSingle(),
    listBookingInspirationImages({ supabase, bookingId: booking.id }),
  ]);

  if (reviewResult.error) {
    throw new Error("Could not load review details.");
  }

  const startsLater = new Date(booking.start_at).getTime() > Date.now();

  return {
    ...displayBooking,
    view: customerBookingView(booking, {
      paidAttempt: displayBooking.paid_attempt,
      holdExpiresAt: displayBooking.hold_expires_at,
    }),
    review: reviewResult.data ?? null,
    inspiration_images: inspirationImages,
    inspiration_allowance: describeInspirationImageAllowance(
      inspirationImages.length,
    ),
    // Photos can be added until the appointment starts (the database and the
    // Storage bucket enforce the same). Read-only for anything else.
    can_manage_inspiration_images:
      displayBooking.status === "confirmed" && Boolean(displayBooking.confirmed_at) && startsLater,
  };
}
