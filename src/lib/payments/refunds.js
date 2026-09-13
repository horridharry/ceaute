import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";
import {
  buildStripeRefundRequest,
  classifyRefundReconciliation,
} from "./refund-request";

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
  eventCreatedAt = /** @type {number | null} */ (null),
  supabase = createServiceRoleClient(),
}) {
  const stripePaymentIntentId = getStripeObjectId(refund.payment_intent);
  const stripeChargeId = getStripeObjectId(refund.charge);

  if (!stripePaymentIntentId) {
    throw new Error("Stripe refund is missing its PaymentIntent.");
  }

  const { error } = await supabase.schema("ceaute").rpc(
    "record_booking_refund_state",
    {
      target_refund_operation_id: refundOperationId,
      target_stripe_refund_id: refund.id,
      target_stripe_payment_intent_id: stripePaymentIntentId,
      target_stripe_charge_id: stripeChargeId,
      target_amount_pence: refund.amount,
      target_status: refund.status ?? "pending",
      target_failure_reason: refund.failure_reason ?? null,
      target_event_created_at: eventCreatedAt,
    },
  );

  if (error) {
    throw new Error(error.message || "Could not record Stripe refund state.");
  }

  return refund.status ?? "pending";
}

function isDefinitiveStripeRefundError(error) {
  return new Set([
    "StripeInvalidRequestError",
    "StripeAuthenticationError",
    "StripePermissionError",
  ]).has(error?.type ?? error?.rawType);
}

async function recordProcessingOutcome({ supabase, operation, outcome, reason }) {
  const { error } = await supabase.schema("ceaute").rpc(
    "record_booking_refund_processing_outcome",
    {
      target_refund_operation_id: operation.refund_operation_id,
      target_outcome: outcome,
      target_failure_reason: reason,
    },
  );

  if (error) {
    throw new Error(error.message || "Could not record refund processing outcome.");
  }
}

async function reconcileUnknownRefund({ stripe, operation }) {
  const refundPage = await stripe.refunds.list({
    payment_intent: operation.stripe_payment_intent_id,
    limit: 100,
  });

  return classifyRefundReconciliation(operation, refundPage);
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

  if (
    operation.action === "complete" ||
    operation.action === "processing" ||
    operation.action === "requires_review"
  ) {
    return {
      action: operation.action,
      status: operation.refund_status,
      stripeRefundId: operation.stripe_refund_id,
    };
  }

  if (operation.action === "verify_before_retry") {
    try {
      const reconciliation = await reconcileUnknownRefund({ stripe, operation });

      if (reconciliation.action === "matched") {
        const status = await recordBookingRefundState({
          refundOperationId: operation.refund_operation_id,
          refund: reconciliation.refund,
          supabase,
        });
        return { action: "reconciled", status, stripeRefundId: reconciliation.refund.id };
      }

      if (reconciliation.action === "requires_review") {
        await recordProcessingOutcome({
          supabase,
          operation,
          outcome: "requires_review",
          reason: reconciliation.reason,
        });
        return { action: "requires_review", status: "requires_review", stripeRefundId: null };
      }
    } catch (error) {
      await recordProcessingOutcome({
        supabase,
        operation,
        outcome: "pending",
        reason: error instanceof Error ? error.message : "Could not reconcile Stripe refunds.",
      });
      return { action: "pending", status: "pending", stripeRefundId: null };
    }
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

    if (!isDefinitiveStripeRefundError(refundError)) {
      try {
        const reconciliation = await reconcileUnknownRefund({ stripe, operation });

        if (reconciliation.action === "matched") {
          const status = await recordBookingRefundState({
            refundOperationId: operation.refund_operation_id,
            refund: reconciliation.refund,
            supabase,
          });
          return { action: "reconciled", status, stripeRefundId: reconciliation.refund.id };
        }

        if (reconciliation.action === "requires_review") {
          await recordProcessingOutcome({
            supabase,
            operation,
            outcome: "requires_review",
            reason: reconciliation.reason,
          });
          return { action: "requires_review", status: "requires_review", stripeRefundId: null };
        }
      } catch {
        // An unprovable create result remains pending for same-key retry.
      }
    }

    const outcome = isDefinitiveStripeRefundError(refundError)
      ? "failed"
      : "pending";
    await recordProcessingOutcome({ supabase, operation, outcome, reason: message });
    return { action: outcome, status: outcome, stripeRefundId: null };
  }
}
