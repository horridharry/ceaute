import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";
import { buildStripeRefundRequest } from "./refund-request";

export function getStripeObjectId(value) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function firstRpcRow(data, message) {
  const row = data?.[0];

  if (!row) {
    throw new Error(message);
  }

  return row;
}

export async function recordBookingRefundState({
  refundOperationId,
  refund,
  supabase = createServiceRoleClient(),
}) {
  const stripePaymentIntentId = getStripeObjectId(refund.payment_intent);

  if (!stripePaymentIntentId) {
    throw new Error("Stripe refund is missing its PaymentIntent.");
  }

  const { error } = await supabase.schema("ceaute").rpc(
    "record_booking_refund_state",
    {
      target_refund_operation_id: refundOperationId,
      target_stripe_refund_id: refund.id,
      target_stripe_payment_intent_id: stripePaymentIntentId,
      target_amount_pence: refund.amount,
      target_status: refund.status ?? "pending",
      target_failure_reason: refund.failure_reason ?? null,
    },
  );

  if (error) {
    throw new Error(error.message || "Could not record Stripe refund state.");
  }

  return refund.status ?? "pending";
}

export async function processBookingRefund(
  refundOperationId,
  {
    stripe = getStripe(),
    supabase = createServiceRoleClient(),
  } = {},
) {
  const { data, error } = await supabase.schema("ceaute").rpc(
    "claim_booking_refund_operation",
    { target_refund_operation_id: refundOperationId },
  );

  if (error) {
    throw new Error(error.message || "Could not claim refund operation.");
  }

  const operation = firstRpcRow(data, "Refund operation was not found.");

  if (operation.action === "complete" || operation.action === "processing") {
    return {
      action: operation.action,
      status: operation.refund_status,
      stripeRefundId: operation.stripe_refund_id,
    };
  }

  try {
    const refundRequest = buildStripeRefundRequest(operation);
    const refund = operation.stripe_refund_id
      ? await stripe.refunds.retrieve(operation.stripe_refund_id)
      : await stripe.refunds.create(
          refundRequest.parameters,
          refundRequest.options,
        );

    const status = await recordBookingRefundState({
      refundOperationId: operation.refund_operation_id,
      refund,
      supabase,
    });

    return {
      action: operation.action,
      status,
      stripeRefundId: refund.id,
    };
  } catch (refundError) {
    const message =
      refundError instanceof Error
        ? refundError.message
        : "Stripe refund processing failed.";
    const failureResult = await supabase.schema("ceaute").rpc(
      "record_booking_refund_retryable_failure",
      {
        target_refund_operation_id: operation.refund_operation_id,
        target_failure_reason: message,
      },
    );

    if (failureResult.error) {
      throw new Error(
        failureResult.error.message || "Could not record refund failure.",
        { cause: refundError },
      );
    }

    throw refundError;
  }
}
