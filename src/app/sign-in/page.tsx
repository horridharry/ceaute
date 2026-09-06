import { redirect } from 'next/navigation';
import { validatedNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import { requestSignIn } from './actions';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
    sent?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const next = validatedNextPath(params.next ?? null);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    if (next) {
      redirect(next);
    }

    const { data: providerPage, error } = await supabase
      .schema('ceaute')
      .from('provider_page')
      .select('id')
      .eq('owner_profile_id', data.claims.sub)
      .maybeSingle();

    if (error) {
      throw new Error('Could not choose your sign-in destination.');
    }

    redirect(providerPage ? '/provider' : '/account');
  }

  const errorMessage =
    params.error === 'invalid-email'
      ? 'Enter a valid email address.'
      : params.error
        ? 'We could not send the sign-in email. Please try again.'
        : null;

  return (
    <main className="page-shell auth-shell">
      <section className="auth-form">
        <span className="wordmark">Ceaute</span>
        <h1>Sign in</h1>

        {params.sent === '1' ? (
          <div className="notice" role="status">
            <strong>Check your email.</strong>
            <span>Use the secure link we sent to continue.</span>
          </div>
        ) : (
          <form action={requestSignIn} className="stack">
            <input name="next" type="hidden" value={next ?? ''} />
            <input
              aria-label="Email address"
              autoComplete="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            {errorMessage ? (
              <p className="error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <button type="submit">Continue</button>
          </form>
        )}
      </section>
    </main>
  );
}
