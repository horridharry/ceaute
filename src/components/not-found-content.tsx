import Link from 'next/link';
import { buttonClassName } from '@/components/ui/button-classes';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeading } from '@/components/ui/page-heading';

export default function NotFoundContent() {
  return (
    <PageContainer className="flex flex-col">
      <Card as="section" padding="lg" className="mt-6 flex flex-col bg-surface">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          Page not found
        </p>
        <PageHeading
          size="md"
          tracking="tight"
          className="mt-4"
          titleClassName="text-ink/90"
          title="That page is not here"
          description="The link may be out of date, or the provider page may not be published yet."
        />
        <Link
          href="/discover"
          className={buttonClassName({ variant: 'primary-strong', className: 'mt-8 w-max' })}
        >
          Discover providers
        </Link>
      </Card>
    </PageContainer>
  );
}
