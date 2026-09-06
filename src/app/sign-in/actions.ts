'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { validatedNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

export async function requestSignIn(formData: FormData) {
  const emailValue = formData.get('email');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const next = validatedNextPath(formData.get('next'));
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : '';

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    redirect(`/sign-in?error=invalid-email${nextQuery}`);
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');

  if (!origin) {
    redirect(`/sign-in?error=unavailable${nextQuery}`);
  }

  const callbackUrl = new URL('/auth/confirm', origin);
  if (next) {
    callbackUrl.searchParams.set('next', next);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(`/sign-in?error=unavailable${nextQuery}`);
  }

  redirect(`/sign-in?sent=1${nextQuery}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
