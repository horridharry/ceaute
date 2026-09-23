// --- Stripe failure events for payment attempts this database never made ----
//
// Every non-production environment shares one Stripe test account, and that
// account's payments webhook points at Preview. A Checkout Session created by
// another environment — a local stack, an isolated acceptance run — therefore
// still reaches Preview when it expires, carrying a `payment_attempt_id` that
// exists only in that other database. Recording the event would violate the
// payment-attempt foreign key, so the webhook answered 500 and Stripe retried
// it for three days.
//
// Only the events that move no money are treated this way: an expired
// session, a failed or cancelled PaymentIntent. There is nothing to undo for
// an attempt that was never created here, so acknowledging them is safe. A
// completed payment or a refund for an unknown attempt is still an error,
// because money did move and someone has to look at it.
//
// Timing cannot make a real attempt look foreign: the attempt row is written
// before its Checkout Session is created, and Stripe only sends these events
// after the session exists.

const NO_MONEY_FAILURE_EVENT_TYPES = new Set([
  "checkout.session.expired",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function isForeignFailureEvent({ supabase, eventType, paymentAttemptId }) {
  if (!NO_MONEY_FAILURE_EVENT_TYPES.has(eventType) || !paymentAttemptId) {
    return false;
  }

  // Not an ID this database could ever have issued.
  if (!UUID_PATTERN.test(paymentAttemptId)) {
    return true;
  }

  const { data, error } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .select("id")
    .eq("id", paymentAttemptId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not look up the Stripe event's payment attempt.");
  }

  return !data;
}
