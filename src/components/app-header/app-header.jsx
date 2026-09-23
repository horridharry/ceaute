import AppHeaderClient from "@/components/app-header/app-header-client";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";

export default async function AppHeader() {
  const { claims } = await getRequestSession();
  const userId = claims?.sub;

  let providerPage = null;
  let profileName = "";

  if (userId) {
    try {
      // Shares the page's own lookup on a full page load. The header uses it
      // for the menus and View your page, so a failed lookup must not take the
      // whole layout down.
      providerPage = await getOwnedProviderPage(userId);
    } catch {
      providerPage = null;
    }

    try {
      // The avatar's initial comes from the name the person gave us.
      const { supabase } = await getRequestSession();
      const { data } = await supabase
        .schema("ceaute")
        .from("profile")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      profileName = String(data?.full_name ?? "").trim();
    } catch {
      profileName = "";
    }
  }

  return (
    <AppHeaderClient
      providerPage={providerPage}
      user={
        userId
          ? {
              id: userId,
              email: claims.email ?? "",
              name:
                profileName ||
                claims.user_metadata?.full_name ||
                claims.user_metadata?.name ||
                claims.email ||
                "Account",
            }
          : null
      }
    />
  );
}
