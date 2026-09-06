'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function startProviderOnboarding() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/provider/onboarding');
  }

  const { error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .upsert(
      { owner_profile_id: userId },
      { onConflict: 'owner_profile_id', ignoreDuplicates: true },
    );

  if (error) {
    throw new Error('Could not start provider onboarding.');
  }

  redirect('/provider');
}
