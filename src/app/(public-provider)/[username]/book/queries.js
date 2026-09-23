import { selectPaidAttempt } from "@/lib/bookings/paid-attempt";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
  const { data: paymentAttempts, error: paymentError } = await paymentSupabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .select("attempt_number, payment_status, amount_charged_pence, refund_amount_pence")
    .eq("booking_id", summary.id)
    .order("attempt_number", { ascending: false });

  if (paymentError) {
    throw new Error("Could not load booking payment status.");
  }

  const latestAttempt = paymentAttempts?.[0] ?? null;
  // The attempt that actually took money, if any: for a hold that was never
  // confirmed this is a payment that arrived too late and is being refunded.
  const paidAttempt = selectPaidAttempt(paymentAttempts ?? []);

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
    payment_status: latestAttempt?.payment_status ?? null,
    paid_attempt: paidAttempt,
  };
}
