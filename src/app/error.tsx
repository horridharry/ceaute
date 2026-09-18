'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { describeRouteError } from '@/lib/errors/route-error';

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Route-level boundary for every page. Loaders and actions throw plain errors
// whose text can be PostgreSQL or Stripe output, so the copy is fixed and the
// digest is the only detail shown.
export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = describeRouteError(error);

  return (
    <main className="container mx-auto flex max-w-md flex-col p-5">
      <section className="mt-6 flex flex-col rounded-2xl border border-black/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-plum">
          {copy.heading}
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-black/90">
          That did not work
        </h1>
        <p className="mt-2 text-sm text-black/60">{copy.message}</p>
        {copy.reference ? (
          <p className="mt-2 text-xs text-black/50">Reference: {copy.reference}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-plum p-2.5 px-4 text-sm font-medium text-white shadow-sm duration-200 hover:opacity-80"
          >
            Try again
          </button>
          <Link
            href="/account/bookings"
            className="text-sm font-semibold text-plum hover:text-plum-hover"
          >
            Check my bookings
          </Link>
        </div>
      </section>
    </main>
  );
}
