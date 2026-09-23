import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeading } from '@/components/ui/page-heading';
import {
  getOwnedProviderPage,
  getRequestSession,
} from '@/lib/auth/request-session';
import { providerWorkspacePath } from '@/lib/providers/onboarding-path';
import { startProviderOnboarding } from './actions';
import { ProviderOnboardingForm } from './_components/provider-onboarding-form';

// The provider draft: a business name and a username, then the dashboard.
// Someone who already has a page never sees this form again.
export default async function DashboardOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = providerWorkspacePath(params?.next);
  const { claims } = await getRequestSession();
  const userId = claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/dashboard/onboarding');
  }

  const providerPage = await getOwnedProviderPage(userId);

  if (providerPage) {
    redirect(next ?? '/dashboard');
  }

  return (
    <PageContainer>
      <PageHeading
        title="Create your business page"
        description="Start with your business name and web address. You’ll set up everything else from your dashboard, and nothing goes live until you publish."
      />
      <ProviderOnboardingForm action={startProviderOnboarding.bind(null, next)} />
    </PageContainer>
  );
}
