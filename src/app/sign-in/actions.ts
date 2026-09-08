'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { validatedNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

type AuthenticationMode = 'login' | 'register';

function signInPath(
  mode: AuthenticationMode,
  statusName: 'error' | 'sent',
  statusValue: string,
  next: string | null,
) {
  const params = new URLSearchParams({
    mode,
    [statusName]: statusValue,
  });

  if (next) {
    params.set('next', next);
  }

  return `/sign-in?${params.toString()}`;
}

async function sendSignInLink(
  mode: AuthenticationMode,
  formData: FormData,
) {
  const emailValue = formData.get('email');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const next = validatedNextPath(formData.get('next'));
  const fullNameValue = formData.get('full_name');
  const fullName = typeof fullNameValue === 'string' ? fullNameValue.trim() : '';

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    redirect(signInPath(mode, 'error', 'invalid-email', next));
  }

  if (mode === 'register' && fullName.length < 2) {
    redirect(signInPath(mode, 'error', 'invalid-name', next));
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');

  if (!origin) {
    redirect(signInPath(mode, 'error', 'unavailable', next));
  }

  const callbackUrl = new URL('/auth/confirm', origin);
  if (next) {
    callbackUrl.searchParams.set('next', next);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: mode === 'register' ? { full_name: fullName } : undefined,
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: mode === 'register',
    },
  });

  if (error) {
    redirect(signInPath(mode, 'error', 'unavailable', next));
  }

  redirect(signInPath(mode, 'sent', '1', next));
}

export async function requestLogin(formData: FormData) {
  await sendSignInLink('login', formData);
}

export async function requestRegistration(formData: FormData) {
  await sendSignInLink('register', formData);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
