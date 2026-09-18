import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-md items-center justify-center p-2">
      <section className="flex w-full flex-col rounded-2xl border border-black/10 bg-white p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-plum">
          That link did not work
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-black/90">
          Request a fresh sign-in email
        </h1>
        <p className="mt-2 text-sm text-black/60">
          The link may have expired or already been used. Your account has not been changed.
        </p>
        <Link
          href="/sign-in"
          className="mt-8 w-max rounded-lg bg-plum p-2.5 px-4 text-sm font-medium text-white shadow-sm duration-200 hover:opacity-80"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
