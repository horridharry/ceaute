import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { validatedNextPath } from '@/lib/auth/redirect';
import {
  captureServerEvent,
  identifyServerUser,
} from '@/lib/posthog-server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = validatedNextPath(searchParams.get('next'));
  const supabase = await createClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('Missing authentication token') };

  if (result.error) {
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;

  if (!userId) {
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  await identifyServerUser(userId, {
    email: claims.email,
    name: claims.user_metadata?.full_name ?? claims.user_metadata?.name,
  });
  await captureServerEvent({
    distinctId: userId,
    event: 'authentication_completed',
    properties: {
      authentication_method: code ? 'authorization_code' : type ?? 'email_otp',
      has_return_path: Boolean(next),
    },
  });

  if (next) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const { data: providerPage, error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  return NextResponse.redirect(
    new URL(providerPage ? '/dashboard' : '/account', request.url),
  );
}
