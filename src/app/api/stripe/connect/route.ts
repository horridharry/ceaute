import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  getStripe,
  stripeAccountToPaymentAccount,
} from '@/lib/stripe/server';

const STRIPE_ACCOUNT_EVENT_TYPES = new Set([
  'v2.core.account.created',
  'v2.core.account.updated',
  'v2.core.account[configuration.recipient].updated',
  'v2.core.account[configuration.recipient].capability_status_updated',
  'v2.core.account[requirements].updated',
  'v2.core.account[future_requirements].updated',
  'v2.core.account_link.returned',
]);

type StripeAccountEvent = {
  type: string;
  data?: {
    account_id?: unknown;
  };
  related_object?: {
    type?: unknown;
    id?: unknown;
  } | null;
};

function getRelatedAccountId(event: StripeAccountEvent) {
  if (event.type === 'v2.core.account_link.returned') {
    return typeof event.data?.account_id === 'string' ? event.data.account_id : null;
  }

  if (
    event.related_object?.type === 'v2.core.account' &&
    typeof event.related_object.id === 'string'
  ) {
    return event.related_object.id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();
  let event;

  try {
    event = stripe.parseEventNotification(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const stripeAccountId = getRelatedAccountId(event);

  const insertEvent = await supabase
    .schema('ceaute')
    .from('stripe_connect_event')
    .insert({
      id: event.id,
      type: event.type,
      stripe_account_id: stripeAccountId,
    });

  if (insertEvent.error?.code === '23505') {
    return NextResponse.json({ received: true });
  }

  if (insertEvent.error) {
    return NextResponse.json({ error: 'Could not record event.' }, { status: 500 });
  }

  if (!STRIPE_ACCOUNT_EVENT_TYPES.has(event.type) || !stripeAccountId) {
    return NextResponse.json({ received: true });
  }

  const { data: paymentAccount, error: lookupError } = await supabase
    .schema('ceaute')
    .from('provider_payment_account')
    .select('provider_page_id')
    .eq('stripe_account_id', stripeAccountId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: 'Could not process event.' }, { status: 500 });
  }

  if (!paymentAccount) {
    return NextResponse.json({ received: true });
  }

  const account = await stripe.v2.core.accounts.retrieve(stripeAccountId, {
    include: ['configuration.recipient', 'identity', 'requirements'],
  });

  const update = await supabase
    .schema('ceaute')
    .from('provider_payment_account')
    .update(stripeAccountToPaymentAccount(account))
    .eq('provider_page_id', paymentAccount.provider_page_id)
    .eq('stripe_account_id', account.id);

  if (update.error) {
    return NextResponse.json({ error: 'Could not update account.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
