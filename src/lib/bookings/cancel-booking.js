import { revalidatePath } from "next/cache";
import { enqueueBookingTransactionalEmails } from "@/lib/emails/booking-emails";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";

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
  };
}

async function markRefundSucceeded({ paymentAttemptId, refund }) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .update({
      payment_status: "refunded",
      stripe_refund_id: refund.id,
      refunded_at: new Date().toISOString(),
      refund_failed_at: null,
      failure_reason: null,
    })
    .eq("id", paymentAttemptId)
    .eq("payment_status", "refund_required");

  if (error) {
    throw new Error("Could not record refund success.");
  }
}

async function markRefundPending({ paymentAttemptId, refund }) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .update({
      stripe_refund_id: refund.id,
      failure_reason: null,
    })
    .eq("id", paymentAttemptId)
    .eq("payment_status", "refund_required");

  if (error) {
    throw new Error("Could not record refund.");
  }
}

async function markRefundFailed({ paymentAttemptId, message }) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .update({
      payment_status: "refund_failed",
      refund_failed_at: new Date().toISOString(),
      failure_reason: message || "Automatic refund failed.",
    })
    .eq("id", paymentAttemptId)
    .eq("payment_status", "refund_required");

  if (error) {
    throw new Error("Could not record refund failure.");
  }
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

  if (
    result.refundAmountPence > 0 &&
    result.paymentAttemptId &&
    result.stripePaymentIntentId
  ) {
    const stripe = getStripe();

    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: result.stripePaymentIntentId,
          amount: result.refundAmountPence,
          reason: "requested_by_customer",
          reverse_transfer: true,
          ...(result.ceauteFeePence > 0
            ? { refund_application_fee: true }
            : {}),
          metadata: {
            booking_id: result.bookingId,
            payment_attempt_id: result.paymentAttemptId,
            cancelled_by: actor,
          },
        },
        {
          idempotencyKey: `booking-cancellation-${result.bookingId}-${result.refundAmountPence}`,
        },
      );

      if (refund.status === "failed" || refund.status === "canceled") {
        await markRefundFailed({
          paymentAttemptId: result.paymentAttemptId,
          message: `Stripe refund ${refund.status}.`,
        });
      } else if (refund.status === "succeeded") {
        await markRefundSucceeded({
          paymentAttemptId: result.paymentAttemptId,
          refund,
        });
      } else {
        await markRefundPending({
          paymentAttemptId: result.paymentAttemptId,
          refund,
        });
      }
    } catch (refundError) {
      await markRefundFailed({
        paymentAttemptId: result.paymentAttemptId,
        message:
          refundError instanceof Error
            ? refundError.message
            : "Automatic refund failed.",
      });
    }
  }

  await enqueueBookingTransactionalEmails({
    bookingId: result.bookingId,
    event: actor === "provider" ? "provider_cancelled" : "customer_cancelled",
  });

  for (const path of revalidatePaths) {
    revalidatePath(path);
  }

  return result;
}
