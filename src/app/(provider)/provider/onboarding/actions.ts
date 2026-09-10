'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function normalizeUsername(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '')
    .slice(0, 30);
}

export async function startProviderOnboarding(_currentState: string, formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/provider/onboarding');
  }

  const displayName = String(formData.get('business_name') ?? '').trim();
  const username = normalizeUsername(formData.get('username'));
  const biography = String(formData.get('biography') ?? '').trim();

  if (displayName.length < 2) {
    return 'Please enter a business name.';
  }

  if (username.length < 3 || username.length > 30) {
    return 'Username must be between 3 and 30 characters long.';
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

  const { data: existingUsername, error: usernameError } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id')
    .eq('username', username)
    .neq('owner_profile_id', userId)
    .maybeSingle();

  if (usernameError) {
    return 'Could not check that username.';
  }

  if (existingUsername) {
    return 'Username already exists.';
  }

  const providerPageValues = {
    display_name: displayName,
    username,
    biography: biography || null,
    status: 'draft',
  };

  const { error } = existingProviderPage
    ? await supabase
        .schema('ceaute')
        .from('provider_page')
        .update(providerPageValues)
        .eq('id', existingProviderPage.id)
    : await supabase
        .schema('ceaute')
        .from('provider_page')
        .insert({
          ...providerPageValues,
          owner_profile_id: userId,
        });

  if (error) {
    return 'Could not save provider onboarding.';
  }

  revalidatePath('/', 'layout');
  redirect('/provider');
}
