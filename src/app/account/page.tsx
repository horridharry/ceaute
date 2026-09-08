import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/(authenticate)/actions';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/account');
  }

  const { data: providerPage, error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load your account.');
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
      <section className="card stack content-card">
        <h1>Account</h1>
        {providerPage ? (
          <Link className="button-link" href="/provider">
            Manage your business
          </Link>
        ) : (
          <Link className="button-link" href="/provider/onboarding">
            Become a provider
          </Link>
        )}
      </section>
    </main>
  );
}
