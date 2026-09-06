import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/sign-in/actions';
import { startProviderSetup } from '@/app/provider/setup/actions';

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
        <Link className="wordmark" href="/">
          Ceaute
        </Link>
        <form action={signOut}>
          <button className="secondary-button" type="submit">
            Sign out
          </button>
        </form>
      </nav>
      <section className="card stack content-card">
        <p className="eyebrow">Your Ceaute account</p>
        <h1>Book beauty. Build your business.</h1>
        <p className="muted">
          This one account works for customer bookings and your provider page.
        </p>
        {providerPage ? (
          <Link className="button-link" href="/provider/setup">
            Continue provider setup
          </Link>
        ) : (
          <form action={startProviderSetup}>
            <button type="submit">Start provider setup</button>
          </form>
        )}
      </section>
    </main>
  );
}
