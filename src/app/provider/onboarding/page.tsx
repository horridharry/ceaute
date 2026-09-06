import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { startProviderOnboarding } from './actions';

export default async function ProviderOnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/provider/onboarding');
  }

  const { data: providerPage, error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id, status')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load provider onboarding.');
  }

  return (
    <main className="page-shell">
      <nav className="topbar">
        <Link className="wordmark" href="/account">
          Ceaute
        </Link>
        <Link href="/account">Account</Link>
      </nav>
      <section className="plain-content stack">
        <h1>Provider onboarding</h1>
        {providerPage ? (
          <>
            <p>Status: {providerPage.status}</p>
            <Link className="button-link" href="/provider">
              Return to provider Home
            </Link>
          </>
        ) : (
          <form action={startProviderOnboarding}>
            <button type="submit">Begin onboarding</button>
          </form>
        )}
      </section>
    </main>
  );
}
