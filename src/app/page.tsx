import Link from 'next/link';

export default function Home() {
  return (
    <main className="page-shell hero-shell">
      <nav className="topbar">
        <span className="wordmark">Ceaute</span>
        <Link href="/sign-in">Sign in</Link>
      </nav>
      <section className="hero stack">
        <p className="eyebrow">Independent beauty, easier to book</p>
        <h1>One account for appointments and your business.</h1>
        <p className="muted hero-copy">
          Find beauty providers as a customer, or start building your own Ceaute page.
        </p>
        <div className="actions">
          <Link className="button-link" href="/sign-in">
            Sign in or register
          </Link>
          <Link className="text-link" href="/sign-in?next=/account">
            Start provider setup
          </Link>
        </div>
      </section>
    </main>
  );
}
