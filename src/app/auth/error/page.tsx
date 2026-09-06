import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <main className="page-shell auth-shell">
      <section className="card auth-card stack">
        <p className="eyebrow">That link did not work</p>
        <h1>Request a fresh sign-in email</h1>
        <p className="muted">
          The link may have expired or already been used. Your account has not been changed.
        </p>
        <Link className="button-link" href="/sign-in">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
