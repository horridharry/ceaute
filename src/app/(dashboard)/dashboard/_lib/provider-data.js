import { redirect } from "next/navigation";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";
import { providerOnboardingPath } from "@/lib/providers/onboarding-path";

// Session verification and the provider-page lookup are memoised per render
// (see request-session.js), so a page whose helpers each call this still pays
// for one claims check and one provider_page query.
export async function getSignedInProvider({ next = "/dashboard" } = {}) {
  const { supabase, claims } = await getRequestSession();
  const userId = claims?.sub;

  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const providerPage = await getOwnedProviderPage(userId);

  if (!providerPage) {
    // Keep where they were going, so creating the page lands them there.
    redirect(providerOnboardingPath(next));
  }

  return {
    supabase,
    user: {
      id: userId,
      name: claims.user_metadata?.full_name ?? "",
      email: claims.email ?? "",
    },
    providerPage,
  };
}
