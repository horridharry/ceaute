import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getStripe } from '@/lib/stripe/server';
import {
  describeProviderDisputeLiability,
  describeProviderRestriction,
  planLiabilityRecovery,
  PROVIDER_AGREEMENT_VERSION,
} from '@/lib/payments/provider-liability';

// Outstanding provider debt, and the one action that can reduce it.
//
// Recovery is operator-invoked, never automatic. Taking money back from a
// provider on a webhook would mean acting on a dispute outcome before anybody
// has decided who was at fault, and the decision is the whole point.
function unauthorized(request: NextRequest) {
  const operatorSecret = process.env.CEAUTE_OPERATOR_SECRET;
  const authHeader = request.headers.get('authorization');

  return !operatorSecret || authHeader !== `Bearer ${operatorSecret}`;
}

export async function GET(request: NextRequest) {
  if (unauthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const includeResolved =
    request.nextUrl.searchParams.get('include_resolved') === 'true';
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema('ceaute')
    .rpc('list_provider_liabilities', {
      include_resolved: includeResolved,
      max_liabilities: 100,
    });

  if (error) {
    return NextResponse.json(
      { error: 'Could not load provider liabilities.' },
      { status: 500 },
    );
  }

  const liabilities = (data ?? []) as Array<Record<string, unknown>>;
  // Grouped by provider, because "is this provider restricted" is the question
  // the control actually answers.
  const byProvider = new Map<string, { provider_username: unknown; outstanding_pence: number }>();

  for (const liability of liabilities) {
    const key = String(liability.provider_page_id);
    const current = byProvider.get(key) ?? {
      provider_username: liability.provider_username,
      outstanding_pence: 0,
    };

    current.outstanding_pence += Number(liability.outstanding_pence ?? 0);
    byProvider.set(key, current);
  }

  return NextResponse.json({
    liabilities,
    providers: [...byProvider.entries()].map(([providerPageId, summary]) => ({
      provider_page_id: providerPageId,
      provider_username: summary.provider_username,
      outstanding_pence: summary.outstanding_pence,
      // Agreement acceptance is not in this listing, so only the debt gate is
      // evaluated here; the full standing is what checkout reads.
      restricted_by_debt: describeProviderRestriction({
        outstandingPence: summary.outstanding_pence,
        acceptedAgreementVersion: PROVIDER_AGREEMENT_VERSION,
      }).restricted,
    })),
    required_agreement_version: PROVIDER_AGREEMENT_VERSION,
  });
}

// Two actions:
//   record  — a lost, provider-responsible dispute becomes a debt.
//   recover — try to take back what Stripe still can, and leave the rest owed.
export async function POST(request: NextRequest) {
  if (unauthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 });
  }

  const action = String(body.action ?? '').trim();
  const supabase = createServiceRoleClient();

  if (action === 'record') {
    return recordLiability(body, supabase);
  }

  if (action === 'recover') {
    return recoverLiability(body, supabase);
  }

  return NextResponse.json(
    { error: 'action must be "record" or "recover".' },
    { status: 400 },
  );
}

async function recordLiability(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>,
) {
  const stripeDisputeId = String(body.stripe_dispute_id ?? '').trim();

  if (!stripeDisputeId) {
    return NextResponse.json(
      { error: 'stripe_dispute_id is required.' },
      { status: 400 },
    );
  }

  const { data: disputes, error: disputeError } = await supabase
    .schema('ceaute')
    .rpc('list_booking_disputes', { include_closed: true, max_disputes: 500 });

  if (disputeError) {
    return NextResponse.json({ error: 'Could not load the dispute.' }, { status: 500 });
  }

  const dispute = (disputes ?? []).find(
    (row: Record<string, unknown>) => row.stripe_dispute_id === stripeDisputeId,
  );

  if (!dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  }

  const liability = describeProviderDisputeLiability({
    disputedAmountPence: Number(dispute.amount_pence ?? 0),
    responsibility: String(dispute.responsibility ?? 'undetermined'),
    disputeStatus: String(dispute.status ?? ''),
  });

  if (!liability.createsLiability) {
    return NextResponse.json({ recorded: false, reason: liability.reason });
  }

  const { data, error } = await supabase
    .schema('ceaute')
    .rpc('record_provider_liability', {
      target_stripe_dispute_id: stripeDisputeId,
      target_amount_owed_pence: liability.amountOwedPence,
      target_note: body.note ? String(body.note) : null,
    });

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Could not record the liability.' },
      { status: 400 },
    );
  }

  return NextResponse.json({ recorded: true, liability: data?.[0] ?? null });
}

async function recoverLiability(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>,
) {
  const liabilityId = String(body.liability_id ?? '').trim();

  if (!liabilityId) {
    return NextResponse.json({ error: 'liability_id is required.' }, { status: 400 });
  }

  const { data: rows, error } = await supabase
    .schema('ceaute')
    .rpc('list_provider_liabilities', { include_resolved: true, max_liabilities: 500 });

  if (error) {
    return NextResponse.json({ error: 'Could not load the liability.' }, { status: 500 });
  }

  const liability = (rows ?? []).find(
    (row: Record<string, unknown>) => row.liability_id === liabilityId,
  );

  if (!liability) {
    return NextResponse.json({ error: 'Liability not found.' }, { status: 404 });
  }

  const stripe = getStripe();

  try {
    // The transfer to reverse, and how much of it is left.
    const { data: attempts } = await supabase
      .schema('ceaute')
      .from('booking_payment_attempt')
      .select('stripe_payment_intent_id, provider_stripe_account_id')
      .eq('booking_id', liability.booking_id)
      .maybeSingle();

    if (!attempts?.stripe_payment_intent_id) {
      return NextResponse.json(
        { recovered_pence: 0, reason: 'No payment attempt to reverse.' },
        { status: 409 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      attempts.stripe_payment_intent_id,
      { expand: ['latest_charge'] },
    );
    const charge = paymentIntent.latest_charge as Stripe.Charge | null;
    const transferId =
      typeof charge?.transfer === 'string' ? charge.transfer : charge?.transfer?.id;

    if (!transferId) {
      return NextResponse.json(
        { recovered_pence: 0, reason: 'The charge has no transfer to reverse.' },
        { status: 409 },
      );
    }

    const transfer = await stripe.transfers.retrieve(transferId);
    // Stripe rejects a reversal the connected balance cannot meet, turning a
    // partial recovery into none, so the balance is read first.
    // `stripeAccount` is a request option, not a parameter: it is what makes
    // this read the connected account's balance rather than the platform's.
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: attempts.provider_stripe_account_id },
    );
    const availableGbp =
      balance.available.find((entry) => entry.currency === 'gbp')?.amount ?? 0;

    const plan = planLiabilityRecovery({
      outstandingPence: Number(liability.outstanding_pence ?? 0),
      transferReversiblePence: transfer.amount - transfer.amount_reversed,
      connectedAvailablePence: availableGbp,
    });

    if (!plan.canRecover) {
      return NextResponse.json({
        recovered_pence: 0,
        outstanding_pence: Number(liability.outstanding_pence ?? 0),
        reason: plan.blockedReason,
      });
    }

    const reversal = await stripe.transfers.createReversal(
      transferId,
      { amount: plan.recoverablePence },
      // Keyed on the liability and the amount, so a retried request cannot
      // reverse the same money twice.
      { idempotencyKey: `ceaute-liability-${liabilityId}-${plan.recoverablePence}` },
    );

    const { data: recorded, error: recordError } = await supabase
      .schema('ceaute')
      .rpc('record_provider_liability_recovery', {
        target_liability_id: liabilityId,
        target_recovered_pence: plan.recoverablePence,
        target_reference: reversal.id,
      });

    if (recordError) {
      // Stripe moved the money; failing to record it must be loud, because the
      // ledger now understates recovery.
      return NextResponse.json(
        {
          error: 'Reversal succeeded but was not recorded.',
          stripe_reversal_id: reversal.id,
          recovered_pence: plan.recoverablePence,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      recovered_pence: plan.recoverablePence,
      remaining_pence: plan.remainingPence,
      stripe_reversal_id: reversal.id,
      liability: recorded?.[0] ?? null,
    });
  } catch (recoveryError) {
    return NextResponse.json(
      {
        error:
          recoveryError instanceof Error
            ? recoveryError.message
            : 'Could not recover from the connected account.',
      },
      { status: 502 },
    );
  }
}
