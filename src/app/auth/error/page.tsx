import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-sm items-center px-5 py-12">
      <section className="flex w-full flex-col">
        <p className="text-xs font-bold uppercase tracking-widest text-accent-600">
          That link did not work
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-black/90">
          Request a fresh sign-in email
        </h1>
        <p className="mt-2 text-sm text-black/60">
          The link may have expired or already been used. Your account has not
          been changed.
        </p>
        <Link
          href="/sign-in"
          className="mt-8 w-max rounded-lg bg-accent-700 p-2.5 px-4 text-sm font-medium text-white shadow-sm duration-200 hover:opacity-80"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
