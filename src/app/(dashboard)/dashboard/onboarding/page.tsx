import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { startProviderOnboarding } from './actions';
import { ProviderOnboardingForm } from './_components/provider-onboarding-form';

export default async function DashboardOnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/dashboard/onboarding');
  }

  const { data: providerPage, error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id, username, display_name, biography, status')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load provider onboarding.');
  }

  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <Link
          href="/account"
          className="mb-6 w-max text-sm font-medium text-black/50 duration-200 hover:text-black"
        >
          Account
        </Link>
        <h1 className="text-3xl font-bold tracking-tighter">Provider setup</h1>
        <p className="mt-1 text-sm">
          Start your provider draft and continue into your workspace.
        </p>

        <div className="mt-6 rounded-xl border p-3">
          <h2 className="text-sm font-medium text-pink-600">Setup progress</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            <li className="flex items-center justify-between border-b pb-2">
              <span>Account created</span>
              <span className="font-medium text-pink-600">Done</span>
            </li>
            <li className="flex items-center justify-between border-b pb-2">
              <span>Provider draft</span>
              <span className="font-medium text-pink-600">
                {providerPage ? 'Started' : 'Next'}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Complete workspace details</span>
              <span className="text-black/40">Later</span>
            </li>
          </ul>
        </div>

        <ProviderOnboardingForm
          action={startProviderOnboarding}
          providerPage={{
            businessName: providerPage?.display_name ?? '',
            username: providerPage?.username ?? '',
            biography: providerPage?.biography ?? '',
            status: providerPage?.status ?? 'new',
          }}
        />
      </div>
    </main>
  );
}
