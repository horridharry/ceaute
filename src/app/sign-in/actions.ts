'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

export async function requestSignIn(formData: FormData) {
  const emailValue = formData.get('email');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const next = safeNextPath(formData.get('next'));

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    redirect(`/sign-in?error=invalid-email&next=${encodeURIComponent(next)}`);
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');

  if (!origin) {
    redirect(`/sign-in?error=unavailable&next=${encodeURIComponent(next)}`);
  }

  const callbackUrl = new URL('/auth/confirm', origin);
  callbackUrl.searchParams.set('next', next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(`/sign-in?error=unavailable&next=${encodeURIComponent(next)}`);
  }

  redirect(`/sign-in?sent=1&next=${encodeURIComponent(next)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
