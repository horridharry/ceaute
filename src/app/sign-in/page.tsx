import Link from 'next/link';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/redirect';
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
  const next = safeNextPath(params.next ?? null);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect(next);
  }

  const errorMessage =
    params.error === 'invalid-email'
      ? 'Enter a valid email address.'
      : params.error
        ? 'We could not send the sign-in email. Please try again.'
        : null;

  return (
    <main className="page-shell auth-shell">
      <section className="card auth-card">
        <Link className="wordmark" href="/">
          Ceaute
        </Link>
        <div className="stack">
          <p className="eyebrow">One account for everything</p>
          <h1>Sign in or create your account</h1>
          <p className="muted">
            Use the same account to book appointments and manage your own provider page.
          </p>
        </div>

        {params.sent === '1' ? (
          <div className="notice" role="status">
            <strong>Check your email.</strong>
            <span>Use the secure link we sent to continue.</span>
          </div>
        ) : (
          <form action={requestSignIn} className="stack">
            <input name="next" type="hidden" value={next} />
            <label htmlFor="email">Email address</label>
            <input
              autoComplete="email"
              id="email"
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
            <button type="submit">Email me a sign-in link</button>
          </form>
        )}
      </section>
    </main>
  );
}
