import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hoursUntilEvidenceDue } from '@/lib/payments/disputes';
import {
  DISPUTE_RESPONSIBILITIES,
  decideDisputeSettlement,
} from '@/lib/payments/settlement-rules';

// The operator's way to find affected bookings and read dispute state. There is
// no administration UI in Ceaute and building one is not the minimum, so this
// is a secret-protected read in the same shape as the scheduled routes.
//
// It has its own secret rather than reusing CRON_SECRET: that token lives in
// Supabase Vault and is handed to a machine, while this one is read by a person
// on a laptop. Mixing them would mean a leaked operator link exposes the cron
// endpoints too.
//
// The payload is narrow on purpose. It carries enough to find the booking in
// Stripe and in the dashboard and to judge urgency, and no customer contact
// details.
export async function GET(request: NextRequest) {
  const operatorSecret = process.env.CEAUTE_OPERATOR_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!operatorSecret || authHeader !== `Bearer ${operatorSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const includeClosed =
    request.nextUrl.searchParams.get('include_closed') === 'true';
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema('ceaute')
    .rpc('list_booking_disputes', {
      include_closed: includeClosed,
      max_disputes: 100,
    });

  if (error) {
    return NextResponse.json(
      { error: 'Could not load disputes.' },
      { status: 500 },
    );
  }

  const disputes = (data ?? []).map(
    (dispute: Record<string, unknown>) => ({
      ...dispute,
      hours_until_evidence_due: hoursUntilEvidenceDue(
        dispute.evidence_due_at as string | null,
      ),
      // A dispute with no booking behind it needs a human immediately: it means
      // Stripe has a charge we cannot account for.
      booking_matched: Boolean(dispute.booking_id),
      // What the outcome *should* settle to. Nothing acts on this: recovering
      // from a provider has no mechanism, so an operator reads it and decides.
      settlement: decideDisputeSettlement({
        amountChargedPence: Number(dispute.amount_charged_pence ?? dispute.amount_pence ?? 0),
        applicationFeePence: Number(dispute.application_fee_pence ?? 0),
        disputeStatus: String(dispute.status ?? ''),
        responsibility: String(dispute.responsibility ?? 'undetermined'),
      }),
    }),
  );

  return NextResponse.json({
    disputes,
    open_count: disputes.filter(
      (dispute: { closed_at: unknown }) => !dispute.closed_at,
    ).length,
  });
}


// Records who carries a lost dispute. An operator decision, not an automatic
// one: assuming the provider is at fault would make Ceaute the insurer by
// default, and assuming Ceaute is would do the opposite. Setting this moves no
// money — there is no debit mechanism — it only makes the intended settlement
// explicit and auditable.
export async function POST(request: NextRequest) {
  const operatorSecret = process.env.CEAUTE_OPERATOR_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!operatorSecret || authHeader !== `Bearer ${operatorSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { stripe_dispute_id?: unknown; responsibility?: unknown; note?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 });
  }

  const stripeDisputeId = String(body.stripe_dispute_id ?? '').trim();
  const responsibility = String(body.responsibility ?? '').trim();

  if (!stripeDisputeId || !DISPUTE_RESPONSIBILITIES.includes(responsibility)) {
    return NextResponse.json(
      {
        error: `stripe_dispute_id and a responsibility of ${DISPUTE_RESPONSIBILITIES.join(', ')} are required.`,
      },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema('ceaute')
    .rpc('set_booking_dispute_responsibility', {
      target_stripe_dispute_id: stripeDisputeId,
      target_responsibility: responsibility,
      target_note: body.note ? String(body.note) : null,
    });

  if (error) {
    return NextResponse.json(
      { error: 'Could not set dispute responsibility.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ dispute: data?.[0] ?? null });
}
