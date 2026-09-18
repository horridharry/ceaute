import { redirect } from 'next/navigation';
import {
  getOwnedProviderPage,
  getRequestSession,
} from '@/lib/auth/request-session';
import { startProviderOnboarding } from './actions';
import { ProviderOnboardingForm } from './_components/provider-onboarding-form';

export default async function DashboardOnboardingPage() {
  const { claims } = await getRequestSession();
  const userId = claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/dashboard/onboarding');
  }

  // Memoised per render, so the header in the root layout and this page share
  // one provider_page lookup on a full page load.
  const providerPage = await getOwnedProviderPage(userId);

  return (
    <ProviderOnboardingForm
      action={startProviderOnboarding}
      providerPage={{
        businessName: providerPage?.display_name ?? '',
        username: providerPage?.username ?? '',
        biography: providerPage?.biography ?? '',
        status: providerPage?.status ?? 'new',
      }}
    />
  );
}
