'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { createClient } from '@/lib/supabase/server';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  normalizeUsername,
} from '../_lib/username';

export async function startProviderOnboarding(_currentState: string, formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/dashboard/onboarding');
  }

  const displayName = String(formData.get('business_name') ?? '').trim();
  const username = normalizeUsername(formData.get('username'));
  const biography = String(formData.get('biography') ?? '').trim();

  if (displayName.length < 2) {
    return 'Please enter a business name.';
  }

  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long.`;
  }

  if (biography.length > 500) {
    return 'Short bio must be 500 characters or fewer.';
  }

  const { data: existingProviderPage, error: existingProviderPageError } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (existingProviderPageError) {
    return 'Could not load your provider draft.';
  }

  const providerPageValues = {
    display_name: displayName,
    username,
    biography: biography || null,
  };

  // Username uniqueness is decided by PostgreSQL's partial unique index. RLS
  // only lets this user see their own provider page, so a pre-check could
  // never see another provider's username; the write is the authority.
  const { error } = existingProviderPage
    ? await supabase
        .schema('ceaute')
        .from('provider_page')
        .update(providerPageValues)
        .eq('id', existingProviderPage.id)
    : await supabase
        .schema('ceaute')
        .rpc('create_provider_page_draft', {
          target_display_name: displayName,
          target_username: username,
          target_biography: biography,
        });

  if (error) {
    if (error.code === '23505') {
      return 'That username is already taken.';
    }

    if (error.code === '23514') {
      return 'Check the details and try again.';
    }

    console.error('Provider onboarding save failed', {
      userId,
      existingProviderPageId: existingProviderPage?.id ?? null,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return 'Could not save provider onboarding.';
  }

  // First step of the provider activation funnel.
  await captureServerEvent({
    distinctId: userId,
    event: 'provider_onboarding_completed',
    properties: { username },
  });

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
