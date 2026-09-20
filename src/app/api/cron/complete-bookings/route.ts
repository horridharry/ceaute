import { NextResponse, type NextRequest } from 'next/server';
import { discardAbandonedInspirationImages } from '@/lib/bookings/discard-inspiration-images';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

// Booking lifecycle maintenance. Completing elapsed appointments and discarding
// the inspiration images of bookings that were never paid for are both "the
// booking has moved on, tidy up after it", so they share this pass rather than
// each getting a schedule of their own. A failure in either is reported without
// stopping the other: neither is more urgent than the other, and both are
// retried on the next run.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema('ceaute')
    .rpc('complete_elapsed_bookings', {
      max_bookings: 500,
    });

  let discarded = 0;
  let discardFailed = false;

  try {
    ({ discarded } = await discardAbandonedInspirationImages({ supabase }));
  } catch {
    discardFailed = true;
  }

  const completed = Number(data ?? 0);

  if (error || discardFailed) {
    return NextResponse.json(
      {
        error: [
          error ? 'Could not complete elapsed bookings.' : null,
          discardFailed
            ? 'Could not discard abandoned inspiration images.'
            : null,
        ]
          .filter(Boolean)
          .join(' '),
        completed: error ? 0 : completed,
        inspirationImagesDiscarded: discarded,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    completed,
    inspirationImagesDiscarded: discarded,
  });
}
