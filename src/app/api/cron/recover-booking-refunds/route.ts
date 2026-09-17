import { NextResponse, type NextRequest } from 'next/server';
import { recoverStuckBookingRefunds } from '@/lib/payments/refund-recovery';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await recoverStuckBookingRefunds({ limit: 25 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Could not recover booking refunds.' },
      { status: 500 },
    );
  }
}
