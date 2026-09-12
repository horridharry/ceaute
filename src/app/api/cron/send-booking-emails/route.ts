import { NextResponse, type NextRequest } from 'next/server';
import { deliverPendingBookingEmails } from '@/lib/emails/booking-emails';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await deliverPendingBookingEmails({ limit: 25 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Could not process booking emails.' },
      { status: 500 },
    );
  }
}

