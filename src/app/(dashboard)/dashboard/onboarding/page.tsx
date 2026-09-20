import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getOwnedProviderPage,
  getRequestSession,
} from '@/lib/auth/request-session';
import { providerWorkspacePath } from '@/lib/providers/onboarding-path';
import { startProviderOnboarding } from './actions';
import { ProviderOnboardingForm } from './_components/provider-onboarding-form';

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

  // Memoised per render, so the header in the root layout and this page share
  // one provider_page lookup on a full page load.
  const providerPage = await getOwnedProviderPage(userId);

  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <Link
          href="/account"
          className="mb-6 w-max text-sm font-medium text-black/50 duration-200 hover:text-black"
        >
          Account
        </Link>
        <h1 className="text-3xl font-bold tracking-tighter">Provider setup</h1>
        <p className="mt-1 text-sm">
          Start your provider draft and continue into your workspace.
        </p>

        <div className="mt-6 rounded-xl border p-3">
          <h2 className="text-sm font-medium text-accent-600">Setup progress</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            <li className="flex items-center justify-between border-b pb-2">
              <span>Account created</span>
              <span className="font-medium text-accent-600">Done</span>
            </li>
            <li className="flex items-center justify-between border-b pb-2">
              <span>Provider draft</span>
              <span className="font-medium text-accent-600">
                {providerPage ? 'Started' : 'Next'}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Complete workspace details</span>
              <span className="text-black/40">Later</span>
            </li>
          </ul>
        </div>

        <ProviderOnboardingForm
          action={startProviderOnboarding.bind(null, next)}
          providerPage={{
            businessName: providerPage?.display_name ?? '',
            username: providerPage?.username ?? '',
            biography: providerPage?.biography ?? '',
            status: providerPage?.status ?? 'new',
          }}
        />
      </div>
    </main>
  );
}
