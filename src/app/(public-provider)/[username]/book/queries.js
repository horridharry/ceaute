import {
  describeInspirationImageAllowance,
  listBookingInspirationImages,
} from "@/lib/bookings/booking-inspiration-images";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSignedInCustomer } from "./_lib/signed-in-customer";

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

// Nothing about this step may stand between the customer and paying. If the
// images cannot be loaded the checkout screen still has to render, with the
// payment button on it, so the failure is swallowed into an empty list rather
// than thrown up to the route's error boundary.
export async function getBookingInspirationImages(bookingId) {
  try {
    const { supabase } = await getSignedInCustomer();
    const images = await listBookingInspirationImages({ supabase, bookingId });

    return {
      images,
      allowance: describeInspirationImageAllowance(images.length),
      unavailable: false,
    };
  } catch {
    return {
      images: [],
      allowance: describeInspirationImageAllowance(0),
      unavailable: true,
    };
  }
}
