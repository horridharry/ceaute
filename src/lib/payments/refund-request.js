export function buildStripeRefundRequest(operation) {
  return {
    parameters: {
      payment_intent: operation.stripe_payment_intent_id,
      amount: Number(operation.expected_amount_pence),
      reason:
        operation.purpose === "duplicate_payment"
          ? "duplicate"
          : "requested_by_customer",
      reverse_transfer: true,
      ...(Number(operation.ceaute_fee_pence) > 0
        ? { refund_application_fee: true }
        : {}),
      metadata: {
        booking_id: operation.booking_id,
        payment_attempt_id: operation.payment_attempt_id,
        refund_operation_id: operation.refund_operation_id,
        purpose: operation.purpose,
      },
    },
    options: { idempotencyKey: operation.idempotency_key },
  };
}

function stripeObjectId(value) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

export function classifyRefundReconciliation(operation, refundPage) {
  if (refundPage.has_more) {
    return { action: "requires_review", reason: "Stripe returned more refunds than could be safely inspected." };
  }

  const refunds = refundPage.data ?? [];
  const operationRefunds = refunds.filter(
    (refund) =>
      refund.metadata?.refund_operation_id === operation.refund_operation_id,
  );
  const exactRefunds = operationRefunds.filter(
    (refund) =>
      stripeObjectId(refund.payment_intent) ===
        operation.stripe_payment_intent_id &&
      Number(refund.amount) === Number(operation.expected_amount_pence),
  );

  if (operationRefunds.length !== exactRefunds.length || exactRefunds.length > 1) {
    return { action: "requires_review", reason: "Stripe refund identity or amount is ambiguous." };
  }

  const committedAmount = refunds
    .filter((refund) => !["failed", "canceled", "cancelled"].includes(refund.status))
    .reduce((total, refund) => total + Number(refund.amount ?? 0), 0);

  if (committedAmount > Number(operation.captured_amount_pence)) {
    return { action: "requires_review", reason: "Stripe refunds exceed the captured amount." };
  }

  if (exactRefunds.length === 1) {
    return { action: "matched", refund: exactRefunds[0] };
  }

  if (
    committedAmount + Number(operation.expected_amount_pence) >
    Number(operation.captured_amount_pence)
  ) {
    return { action: "requires_review", reason: "The remaining captured amount cannot satisfy this refund." };
  }

  return { action: "not_found" };
}
