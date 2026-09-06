import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/sign-in/actions';
import { createClient } from '@/lib/supabase/server';

export default async function ProviderHomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/provider');
  }

  const { data: providerPage, error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id, status')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load provider workspace.');
  }

  if (!providerPage) {
    redirect('/provider/onboarding');
  }

  return (
    <main className="page-shell">
      <nav className="topbar">
        <Link className="wordmark" href="/account">
          Ceaute
        </Link>
        <form action={signOut}>
          <button className="secondary-button" type="submit">
            Sign out
          </button>
        </form>
      </nav>
      <section className="plain-content stack">
        <h1>Home</h1>
        <p>Status: {providerPage.status}</p>
        {providerPage.status === 'draft' ? (
          <Link className="button-link" href="/provider/onboarding">
            Continue onboarding
          </Link>
        ) : null}
        <Link href="/account">Account</Link>
        <Link href="/">Go to Ceaute</Link>
      </section>
    </main>
  );
}
