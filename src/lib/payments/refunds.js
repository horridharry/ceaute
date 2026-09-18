import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";
import {
  buildStripeRefundRequest,
  classifyRefundReconciliation,
} from "./refund-request";
import {
  decideRefundSettlement,
  describeCancellationCause,
} from "@/lib/payments/settlement-rules";

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

// The second half of a refund: hand back the share of Ceaute's application fee
// that the canonical rules say belongs to the provider.
//
// This runs after the customer has already been refunded, and deliberately
// never throws. A failure here costs Ceaute the difference and nothing else —
// the customer has their money and the provider has theirs. Losing the
// customer's refund because Ceaute could not settle its own commission would
// be a far worse trade, so the outcome is reported and left for follow-up.
export async function settleApplicationFee({
  operation,
  stripe,
  supabase = createServiceRoleClient(),
}) {
  const result = await supabase
    .schema("ceaute")
    .rpc("get_booking_refund_settlement_inputs", {
      target_refund_operation_id: operation.refund_operation_id,
    });
  const { data, error } = result ?? {};

  if (error) {
    return { settled: false, reason: error.message ?? "Could not read settlement inputs." };
  }

  const inputs = data?.[0];

  if (!inputs) {
    return { settled: false, reason: "Settlement inputs were not found." };
  }

  if (inputs.out_application_fee_refunded) {
    return { settled: true, alreadySettled: true, amountPence: 0 };
  }

  const decision = decideRefundSettlement({
    amountChargedPence: inputs.out_amount_charged_pence,
    applicationFeePence: inputs.out_application_fee_pence,
    refundAmountPence: inputs.out_refund_amount_pence,
    cause: describeCancellationCause({
      purpose: inputs.out_purpose,
      cancelledBy: inputs.out_cancelled_by,
      cancelledLate: inputs.out_cancelled_late,
    }),
  });

  if (decision.applicationFeeRefundPence <= 0) {
    // Nothing to hand back: the provider keeps the whole retention and Ceaute
    // keeps the commission it already holds.
    await supabase.schema("ceaute").rpc("record_booking_application_fee_refund", {
      target_refund_operation_id: operation.refund_operation_id,
      target_stripe_application_fee_refund_id: null,
      target_amount_pence: 0,
    });

    return { settled: true, amountPence: 0, decision };
  }

  try {
    // The ApplicationFee id is not on the refund or the PaymentIntent, only on
    // the charge, so it has to be read back.
    const paymentIntent = await stripe.paymentIntents.retrieve(
      operation.stripe_payment_intent_id,
      { expand: ["latest_charge"] },
    );
    const applicationFeeId = getStripeObjectId(
      paymentIntent?.latest_charge?.application_fee,
    );

    if (!applicationFeeId) {
      return { settled: false, reason: "The charge carries no application fee." };
    }

    const feeRefund = await stripe.applicationFees.createRefund(
      applicationFeeId,
      { amount: decision.applicationFeeRefundPence },
      // Derived from the refund's own key, so a retry of the whole operation
      // reuses it and Stripe returns the original refund rather than a second.
      { idempotencyKey: `${operation.idempotency_key}-appfee` },
    );

    await supabase.schema("ceaute").rpc("record_booking_application_fee_refund", {
      target_refund_operation_id: operation.refund_operation_id,
      target_stripe_application_fee_refund_id: feeRefund.id,
      target_amount_pence: decision.applicationFeeRefundPence,
    });

    return { settled: true, amountPence: decision.applicationFeeRefundPence, decision };
  } catch (settlementError) {
    return {
      settled: false,
      reason:
        settlementError instanceof Error
          ? settlementError.message
          : "Could not refund the application fee.",
      decision,
    };
  }
}

// The customer's refund has already succeeded and been recorded by the time
// this runs. Nothing the settlement does may reach the refund's catch block —
// a thrown settlement would be reconciled as a failed refund and retried,
// which is how a settled refund could look unsettled forever.
async function settleApplicationFeeSafely(arguments_) {
  try {
    return await settleApplicationFee(arguments_);
  } catch (settlementError) {
    return {
      settled: false,
      reason:
        settlementError instanceof Error
          ? settlementError.message
          : "Could not settle the application fee.",
    };
  }
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
    const settlement = await settleApplicationFeeSafely({
      operation,
      stripe,
      supabase,
    });

    return {
      action: operation.action,
      status,
      stripeRefundId: refund.id,
      applicationFeeSettled: settlement.settled,
      applicationFeeRefundPence: settlement.amountPence ?? 0,
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
