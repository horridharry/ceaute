import { revalidatePath } from "next/cache";
import { enqueueBookingTransactionalEmails } from "@/lib/emails/booking-emails";
import { processBookingRefund } from "@/lib/payments/refunds";

function normalizeCancellationResult(results) {
  const result = results?.[0];

  if (!result) {
    throw new Error("Could not cancel booking.");
  }

  return {
    outcome: result.outcome,
    bookingId: result.booking_id,
    paymentAttemptId: result.payment_attempt_id,
    stripePaymentIntentId: result.stripe_payment_intent_id,
    amountPaidPence: Number(result.amount_paid_pence ?? 0),
    refundAmountPence: Number(result.refund_amount_pence ?? 0),
    retainedAmountPence: Number(result.retained_amount_pence ?? 0),
    ceauteFeePence: Number(result.ceaute_fee_pence ?? 0),
    refundOperationId: result.refund_operation_id,
    refundStatus: result.refund_status,
  };
}

export async function cancelBookingWithRefund({
  supabase,
  bookingId,
  actor,
  revalidatePaths,
}) {
  const { data, error } = await supabase.schema("ceaute").rpc(
    "prepare_booking_cancellation",
    {
      target_booking_id: bookingId,
      cancellation_actor: actor,
    },
  );

  if (error) {
    throw new Error(error.message || "Could not cancel booking.");
  }

  const result = normalizeCancellationResult(data);

  if (result.refundAmountPence > 0 && result.refundOperationId) {
    await processBookingRefund(result.refundOperationId);
  }

  if (result.outcome === "cancelled") {
    await enqueueBookingTransactionalEmails({
      bookingId: result.bookingId,
      event: actor === "provider" ? "provider_cancelled" : "customer_cancelled",
    });
  }

  for (const path of revalidatePaths) {
    revalidatePath(path);
  }

  return result;
}
