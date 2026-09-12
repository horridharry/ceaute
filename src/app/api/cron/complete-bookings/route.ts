import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

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

  if (error) {
    return NextResponse.json(
      { error: 'Could not complete elapsed bookings.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    completed: Number(data ?? 0),
  });
}

