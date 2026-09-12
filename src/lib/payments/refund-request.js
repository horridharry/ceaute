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
