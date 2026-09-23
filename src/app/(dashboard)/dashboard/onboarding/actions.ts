'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { providerWorkspacePath } from '@/lib/providers/onboarding-path';
import { createClient } from '@/lib/supabase/server';
import { normalizeUsername, validateUsername } from '@/lib/providers/username';

export type DraftFormState = {
  businessName: string;
  username: string;
  fieldErrors: { business_name?: string; username?: string };
  formError: string;
};

// Creates the provider draft from a business name and a username, then opens
// the dashboard, where everything else is set up (approved 23 September 2026).
// It never updates an existing page: someone who already has one is sent to
// their dashboard.
export async function startProviderOnboarding(
  nextValue: string | null,
  _currentState: DraftFormState | null,
  formData: FormData,
): Promise<DraftFormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const workspace = providerWorkspacePath(nextValue) ?? '/dashboard';

  if (!userId) {
    redirect('/sign-in?next=/dashboard/onboarding');
  }

  const businessName = String(formData.get('business_name') ?? '').trim();
  const username = normalizeUsername(formData.get('username'));
  const state: DraftFormState = { businessName, username, fieldErrors: {}, formError: '' };

  if (businessName.length < 2) {
    state.fieldErrors.business_name = 'Enter a business name of at least 2 characters.';
  } else if (businessName.length > 120) {
    state.fieldErrors.business_name = 'Use 120 characters or fewer.';
  }

  const usernameError = username ? validateUsername(username) : 'Choose a username.';

  if (usernameError) {
    state.fieldErrors.username = usernameError;
  }

  if (state.fieldErrors.business_name || state.fieldErrors.username) {
    return state;
  }

  const { data: existingPage, error: existingError } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (existingError) {
    return { ...state, formError: 'Couldn’t create your page. Try again.' };
  }

  if (existingPage) {
    redirect(workspace);
  }

  const { error } = await supabase.schema('ceaute').rpc('create_provider_page_draft', {
    target_display_name: businessName,
    target_username: username,
    target_biography: '',
  });

  if (error) {
    const message = String(error.message ?? '');

    // Uniqueness is decided by PostgreSQL: RLS only lets this user see their
    // own page, so no pre-check could see another provider's username.
    if (error.code === '23505' && message.includes('provider_page_username_unique')) {
      return {
        ...state,
        fieldErrors: { username: 'That username is taken. Try another.' },
      };
    }

    // A second submission of the same form: the first one created the page.
    if (error.code === '23505') {
      redirect(workspace);
    }

    if (error.code === '23514') {
      return {
        ...state,
        fieldErrors: { username: validateUsername(username) ?? 'Check the username and try again.' },
      };
    }

    console.error('Provider draft creation failed', { userId, code: error.code });
    return { ...state, formError: 'Couldn’t create your page. Try again.' };
  }

  revalidatePath('/', 'layout');
  redirect(workspace);
}
