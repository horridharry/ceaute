import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function ProviderSetupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/provider/setup');
  }

  const { data: providerPage, error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id, status')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load provider setup.');
  }

  if (!providerPage) {
    redirect('/account');
  }

  return (
    <main className="page-shell">
      <nav className="topbar">
        <Link className="wordmark" href="/">
          Ceaute
        </Link>
        <Link href="/account">Account</Link>
      </nav>
      <section className="card stack content-card">
        <p className="eyebrow">Provider setup saved</p>
        <h1>Continue where you left off</h1>
        <p className="muted">
          Your draft belongs to this account and will be here when you return.
        </p>
        <div className="notice">
          <strong>Draft created</strong>
          <span>Provider page details arrive in the next delivery slice.</span>
        </div>
      </section>
    </main>
  );
}
