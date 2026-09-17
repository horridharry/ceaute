import AppHeaderClient from "@/components/app-header/app-header-client";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";

export default async function AppHeader() {
  const { claims } = await getRequestSession();
  const userId = claims?.sub;

  let hasProviderPage = false;

  if (userId) {
    try {
      // Shares the page's own lookup on a full page load. The header only
      // decides which menu label to show, so a failed lookup must not take the
      // whole layout down.
      hasProviderPage = Boolean(await getOwnedProviderPage(userId));
    } catch {
      hasProviderPage = false;
    }
  }

  return (
    <AppHeaderClient
      hasProviderPage={hasProviderPage}
      user={
        userId
          ? {
              email: claims.email ?? "",
              name:
                claims.user_metadata?.full_name ??
                claims.user_metadata?.name ??
                claims.email ??
                "Account",
            }
          : null
      }
    />
  );
}
