import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { eventMatchesStripeMode, resolveStripeMode } from '@/lib/stripe/mode';
import {
  getStripe,
  retrieveStripeAccount,
  syncProviderPaymentAccount,
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
  id: string;
  type: string;
  livemode?: boolean;
  data?: { account_id?: unknown };
  related_object?: { type?: unknown; id?: unknown } | null;
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

async function failEvent(eventId: string, error: unknown) {
  await checkedRpc(
    'fail_stripe_connect_event',
    {
      target_event_id: eventId,
      target_error:
        error instanceof Error ? error.message : 'Stripe Connect event processing failed.',
    },
    'Could not mark Stripe Connect event retryable.',
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();
  let event: StripeAccountEvent;

  try {
    event = stripe.parseEventNotification(
      rawBody,
      signature,
      webhookSecret,
    ) as StripeAccountEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Same reasoning as the payments endpoint: an event from the other mode means
  // this endpoint is pointed at the wrong Stripe mode, and syncing a provider's
  // payment account from it would corrupt real state.
  if (!eventMatchesStripeMode(event, resolveStripeMode())) {
    return NextResponse.json({ error: 'Stripe mode mismatch.' }, { status: 400 });
  }

  if (!STRIPE_ACCOUNT_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const stripeAccountId = getRelatedAccountId(event);

  if (!stripeAccountId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const claimRows = await checkedRpc(
      'claim_stripe_connect_event',
      {
        target_event_id: event.id,
        target_event_type: event.type,
        target_stripe_account_id: stripeAccountId,
      },
      'Could not claim Stripe Connect event.',
    );
    const claim = claimRows?.[0];

    if (!claim) {
      throw new Error('Stripe Connect event claim returned no state.');
    }

    if (claim.action === 'complete') {
      return NextResponse.json({ received: true });
    }

    if (claim.action === 'processing') {
      return NextResponse.json(
        { error: 'Event is already processing.' },
        { status: 409 },
      );
    }

    const supabase = createServiceRoleClient();
    const { data: paymentAccount, error: lookupError } = await supabase
      .schema('ceaute')
      .from('provider_payment_account')
      .select('provider_page_id')
      .eq('stripe_account_id', stripeAccountId)
      .maybeSingle();

    if (lookupError) {
      throw new Error('Could not find the provider payment account.');
    }

    if (!paymentAccount) {
      await checkedRpc(
        'complete_stripe_connect_event',
        { target_event_id: event.id, target_final_status: 'ignored' },
        'Could not ignore Stripe Connect event.',
      );
      return NextResponse.json({ received: true, ignored: true });
    }

    const account = await retrieveStripeAccount(stripe, stripeAccountId);
    await syncProviderPaymentAccount({
      providerPageId: paymentAccount.provider_page_id,
      account,
    });
    await checkedRpc(
      'complete_stripe_connect_event',
      { target_event_id: event.id, target_final_status: 'completed' },
      'Could not complete Stripe Connect event.',
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    try {
      await failEvent(event.id, error);
    } catch {
      // The non-2xx response remains retryable if failure persistence also fails.
    }

    return NextResponse.json(
      { error: 'Could not process Stripe Connect event.' },
      { status: 500 },
    );
  }
}
