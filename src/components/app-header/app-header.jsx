import AppHeaderClient from "@/components/app-header/app-header-client";
import { createClient } from "@/lib/supabase/server";

export default async function AppHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;

  let hasProviderPage = false;

  if (userId) {
    const { data: providerPage } = await supabase
      .schema("ceaute")
      .from("provider_page")
      .select("id")
      .eq("owner_profile_id", userId)
      .maybeSingle();

    hasProviderPage = Boolean(providerPage);
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
