import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import {
  getStripeObjectId,
  processBookingRefund,
  recordBookingRefundState,
} from '@/lib/payments/refunds';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  DISPUTE_EVENT_TYPES,
  describeDisputeEvent,
  isDisputeEventType,
} from '@/lib/payments/disputes';
import { eventMatchesStripeMode, resolveStripeMode } from '@/lib/stripe/mode';
import { getStripe } from '@/lib/stripe/server';

const PAYMENT_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'refund.updated',
  'refund.failed',
  ...DISPUTE_EVENT_TYPES,
]);

function getAttemptIdFromEvent(event: Stripe.Event) {
  const object = event.data.object;
  return 'metadata' in object
    ? (object.metadata?.payment_attempt_id ?? null)
    : null;
}

function getPaymentIntentIdFromEvent(event: Stripe.Event) {
  const object = event.data.object;

  if (event.type.startsWith('payment_intent.') && 'id' in object) {
    return object.id;
  }

  if (event.type === 'checkout.session.completed') {
    return getStripeObjectId((object as Stripe.Checkout.Session).payment_intent);
  }

  if (event.type.startsWith('refund.')) {
    return getStripeObjectId((object as Stripe.Refund).payment_intent);
  }

  if (isDisputeEventType(event.type)) {
    return getStripeObjectId((object as Stripe.Dispute).payment_intent);
  }

  return null;
}

async function checkedRpc(
  name: string,
  parameters: Record<string, unknown>,
  errorMessage: string,
) {
  const supabase = createServiceRoleClient();
  const result = await supabase.schema('ceaute').rpc(name, parameters);

  if (result.error) {
    throw new Error(result.error.message || errorMessage);
  }

  return result.data;
}

async function claimEvent(event: Stripe.Event) {
  const rows = await checkedRpc(
    'claim_stripe_payment_event',
    {
      target_event_id: event.id,
      target_event_type: event.type,
      target_payment_attempt_id: getAttemptIdFromEvent(event),
      target_stripe_payment_intent_id: getPaymentIntentIdFromEvent(event),
    },
    'Could not claim Stripe payment event.',
  );
  const claim = rows?.[0];

  if (!claim) {
    throw new Error('Stripe payment event claim returned no state.');
  }

  return claim;
}

async function completeEvent(eventId: string) {
  await checkedRpc(
    'complete_stripe_payment_event',
    { target_event_id: eventId, target_final_status: 'completed' },
    'Could not complete Stripe payment event.',
  );
}

async function failEvent(eventId: string, error: unknown) {
  await checkedRpc(
    'fail_stripe_payment_event',
    {
      target_event_id: eventId,
      target_error:
        error instanceof Error ? error.message : 'Stripe event processing failed.',
    },
    'Could not mark Stripe payment event retryable.',
  );
}

async function processCompletedCheckout(session: Stripe.Checkout.Session) {
  const paymentAttemptId = session.metadata?.payment_attempt_id ?? null;
  const stripePaymentIntentId = getStripeObjectId(session.payment_intent);

  if (!paymentAttemptId || !stripePaymentIntentId) {
    throw new Error('Paid Checkout Session is missing persisted payment metadata.');
  }

  const rows = await checkedRpc(
    'complete_booking_payment_attempt',
    {
      target_payment_attempt_id: paymentAttemptId,
      target_stripe_payment_intent_id: stripePaymentIntentId,
      target_stripe_checkout_session_id: session.id,
      target_payment_status: session.payment_status,
      target_currency: session.currency,
      target_amount_total: session.amount_total,
    },
    'Could not complete booking payment.',
  );
  const result = rows?.[0];

  if (!result) {
    throw new Error('Payment completion returned no result.');
  }

  if (result.refund_operation_id) {
    const refundResult = await processBookingRefund(result.refund_operation_id);

    if (refundResult.action === 'processing') {
      throw new Error('The required Stripe refund is still being processed.');
    }
  }
}

async function processRefundEvent(refund: Stripe.Refund, eventCreatedAt: number) {
  const stripePaymentIntentId = getStripeObjectId(refund.payment_intent);
  let refundOperationId = refund.metadata?.refund_operation_id ?? null;

  if (!refundOperationId && stripePaymentIntentId) {
    refundOperationId = await checkedRpc(
      'find_booking_refund_operation',
      {
        target_stripe_refund_id: refund.id,
        target_stripe_payment_intent_id: stripePaymentIntentId,
        target_amount_pence: refund.amount,
      },
      'Could not match legacy Stripe refund.',
    );
  }

  if (!refundOperationId) {
    throw new Error('Stripe refund is missing its refund operation metadata.');
  }

  await recordBookingRefundState({
    refundOperationId,
    refund,
    eventCreatedAt,
  });
}

async function processFailureEvent(event: Stripe.Event) {
  const paymentAttemptId = getAttemptIdFromEvent(event);

  if (!paymentAttemptId) {
    throw new Error('Stripe payment event is missing its payment attempt metadata.');
  }

  const object = event.data.object;
  const isExpired = event.type === 'checkout.session.expired';
  const stripeCheckoutSessionId = isExpired && 'id' in object ? object.id : null;

  await checkedRpc(
    'mark_booking_payment_attempt_failed',
    {
      target_payment_attempt_id: paymentAttemptId,
      target_stripe_checkout_session_id: stripeCheckoutSessionId,
      target_stripe_payment_intent_id: getPaymentIntentIdFromEvent(event),
      target_reason: isExpired
        ? 'Checkout session expired.'
        : event.type === 'payment_intent.canceled'
          ? 'Payment was cancelled.'
          : 'Payment failed.',
      target_expired: isExpired,
    },
    'Could not record Stripe payment failure.',
  );
}

// Records the dispute and, for the moments that matter, enqueues one operator
// email. It does not touch the payment attempt: a disputed payment still
// succeeded, and marking it failed would corrupt the booking's own history.
async function processDisputeEvent(event: Stripe.Event) {
  const { parameters } = describeDisputeEvent(event);

  await checkedRpc(
    'record_stripe_dispute',
    parameters,
    'Could not record the Stripe dispute.',
  );
}

async function processEvent(event: Stripe.Event) {
  if (event.type === 'checkout.session.completed') {
    await processCompletedCheckout(event.data.object as Stripe.Checkout.Session);
    return;
  }

  if (event.type === 'refund.updated' || event.type === 'refund.failed') {
    await processRefundEvent(event.data.object as Stripe.Refund, event.created);
    return;
  }

  // Before the failure fallthrough below, which would otherwise mark a disputed
  // — and therefore successful — payment as failed.
  if (isDisputeEventType(event.type)) {
    await processDisputeEvent(event);
    return;
  }

  await processFailureEvent(event);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_PAYMENT_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // A correctly signed event carrying the other mode's data means the endpoint
  // is wired to the wrong Stripe mode. Rejecting is safer than processing it:
  // 400 is not retried into a loop, and the mismatch surfaces in Stripe's own
  // webhook log rather than silently mutating bookings.
  if (!eventMatchesStripeMode(event, resolveStripeMode())) {
    return NextResponse.json({ error: 'Stripe mode mismatch.' }, { status: 400 });
  }

  if (!PAYMENT_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const claim = await claimEvent(event);

    if (claim.action === 'complete') {
      return NextResponse.json({ received: true });
    }

    if (claim.action === 'processing') {
      return NextResponse.json(
        { error: 'Event is already processing.' },
        { status: 409 },
      );
    }

    await processEvent(event);
    await completeEvent(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    try {
      await failEvent(event.id, error);
    } catch {
      // The non-2xx response remains retryable even if failure persistence failed.
    }

    return NextResponse.json(
      { error: 'Could not process Stripe payment event.' },
      { status: 500 },
    );
  }
}
