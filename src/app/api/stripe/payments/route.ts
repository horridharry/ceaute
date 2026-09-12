import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getStripe } from '@/lib/stripe/server';

const PAYMENT_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
]);

function getStringId(value: string | Stripe.PaymentIntent | null | undefined) {
  if (!value) {
    return null;
  }

  return typeof value === 'string' ? value : value.id;
}

function getAttemptIdFromEvent(event: Stripe.Event) {
  const object = event.data.object;

  if (
    event.type.startsWith('checkout.session.') &&
    'metadata' in object &&
    object.metadata?.payment_attempt_id
  ) {
    return object.metadata.payment_attempt_id;
  }

  if (
    event.type.startsWith('payment_intent.') &&
    'metadata' in object &&
    object.metadata?.payment_attempt_id
  ) {
    return object.metadata.payment_attempt_id;
  }

  return null;
}

async function recordEvent({
  event,
  paymentAttemptId,
  stripePaymentIntentId,
}: {
  event: Stripe.Event;
  paymentAttemptId: string | null;
  stripePaymentIntentId: string | null;
}) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.schema('ceaute').from('stripe_payment_event').insert({
    id: event.id,
    type: event.type,
    booking_payment_attempt_id: paymentAttemptId,
    stripe_payment_intent_id: stripePaymentIntentId,
  });

  if (error?.code === '23505') {
    return { supabase, duplicate: true };
  }

  if (error) {
    throw new Error('Could not record payment event.');
  }

  return { supabase, duplicate: false };
}

async function markPaymentFailed({
  paymentAttemptId,
  stripePaymentIntentId,
  reason,
}: {
  paymentAttemptId: string;
  stripePaymentIntentId: string | null;
  reason: string;
}) {
  const supabase = createServiceRoleClient();

  await supabase
    .schema('ceaute')
    .from('booking_payment_attempt')
    .update({
      payment_status: 'failed',
      stripe_payment_intent_id: stripePaymentIntentId,
      failure_reason: reason,
    })
    .eq('id', paymentAttemptId)
    .not('payment_status', 'in', '("succeeded","refunded")');
}

async function processCompletedCheckout({
  event,
  session,
}: {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
}) {
  const paymentAttemptId = session.metadata?.payment_attempt_id ?? null;
  const stripePaymentIntentId = getStringId(session.payment_intent);
  const { supabase, duplicate } = await recordEvent({
    event,
    paymentAttemptId,
    stripePaymentIntentId,
  });

  if (duplicate || !paymentAttemptId || !stripePaymentIntentId) {
    return NextResponse.json({ received: true });
  }

  if (session.payment_status !== 'paid') {
    await markPaymentFailed({
      paymentAttemptId,
      stripePaymentIntentId,
      reason: 'Checkout completed without paid status.',
    });
    return NextResponse.json({ received: true });
  }

  const { data: results, error } = await supabase
    .schema('ceaute')
    .rpc('complete_booking_payment_attempt', {
      target_payment_attempt_id: paymentAttemptId,
      target_stripe_payment_intent_id: stripePaymentIntentId,
      target_stripe_checkout_session_id: session.id,
    });

  if (error) {
    return NextResponse.json({ error: 'Could not complete payment.' }, { status: 500 });
  }

  const result = results?.[0];

  if (result?.outcome !== 'refund_required') {
    return NextResponse.json({ received: true });
  }

  const stripe = getStripe();

  try {
    const refund = await stripe.refunds.create({
      payment_intent: stripePaymentIntentId,
      amount: result.amount_charged_pence,
      reverse_transfer: true,
      ...(result.ceaute_fee_pence > 0 ? { refund_application_fee: true } : {}),
    });

    await supabase
      .schema('ceaute')
      .from('booking_payment_attempt')
      .update({
        payment_status: 'refunded',
        stripe_refund_id: refund.id,
        failure_reason: 'Payment succeeded after the booking could no longer be confirmed.',
      })
      .eq('id', paymentAttemptId)
      .eq('payment_status', 'refund_required');
  } catch {
    await supabase
      .schema('ceaute')
      .from('booking_payment_attempt')
      .update({
        payment_status: 'refund_failed',
        failure_reason: 'Payment succeeded after the booking could no longer be confirmed; automatic refund failed.',
      })
      .eq('id', paymentAttemptId)
      .eq('payment_status', 'refund_required');
  }

  return NextResponse.json({ received: true });
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

  if (!PAYMENT_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  if (event.type === 'checkout.session.completed') {
    return processCompletedCheckout({
      event,
      session: event.data.object as Stripe.Checkout.Session,
    });
  }

  const paymentAttemptId = getAttemptIdFromEvent(event);
  const object = event.data.object;
  const stripePaymentIntentId =
    event.type.startsWith('payment_intent.') && 'id' in object
      ? object.id
      : null;
  const { duplicate } = await recordEvent({
    event,
    paymentAttemptId,
    stripePaymentIntentId,
  });

  if (duplicate || !paymentAttemptId) {
    return NextResponse.json({ received: true });
  }

  if (event.type === 'checkout.session.expired') {
    await markPaymentFailed({
      paymentAttemptId,
      stripePaymentIntentId,
      reason: 'Checkout session expired.',
    });
  }

  if (event.type === 'payment_intent.payment_failed') {
    await markPaymentFailed({
      paymentAttemptId,
      stripePaymentIntentId,
      reason: 'Payment failed.',
    });
  }

  if (event.type === 'payment_intent.canceled') {
    await markPaymentFailed({
      paymentAttemptId,
      stripePaymentIntentId,
      reason: 'Payment was cancelled.',
    });
  }

  return NextResponse.json({ received: true });
}
