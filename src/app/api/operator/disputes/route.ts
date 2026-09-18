import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hoursUntilEvidenceDue } from '@/lib/payments/disputes';

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
    }),
  );

  return NextResponse.json({
    disputes,
    open_count: disputes.filter(
      (dispute: { closed_at: unknown }) => !dispute.closed_at,
    ).length,
  });
}
