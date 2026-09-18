import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container mx-auto flex max-w-md flex-col p-5">
      <section className="mt-6 flex flex-col rounded-2xl border border-black/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-plum">
          Page not found
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-black/90">
          That page is not here
        </h1>
        <p className="mt-2 text-sm text-black/60">
          The link may be out of date, or the provider page may not be published yet.
        </p>
        <Link
          href="/discover"
          className="mt-8 w-max rounded-lg bg-plum p-2.5 px-4 text-sm font-medium text-white shadow-sm duration-200 hover:opacity-80"
        >
          Discover providers
        </Link>
      </section>
    </main>
  );
}
