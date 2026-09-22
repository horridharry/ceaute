'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { buttonClassName } from '@/components/ui/button-classes';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeading } from '@/components/ui/page-heading';
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
    <PageContainer className="flex flex-col">
      <Card as="section" padding="lg" className="mt-6 flex flex-col bg-surface">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          {copy.heading}
        </p>
        <PageHeading
          size="md"
          tracking="tight"
          className="mt-4"
          titleClassName="text-ink/90"
          title="That did not work"
          description={copy.message}
        />
        {copy.reference ? (
          <p className="mt-2 text-xs text-ink-subtle">Reference: {copy.reference}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary-strong" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/account/bookings"
            className={buttonClassName({ variant: 'text' })}
          >
            Check my bookings
          </Link>
        </div>
      </Card>
    </PageContainer>
  );
}
