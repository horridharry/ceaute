import { getSignedInProvider } from "../../_lib/provider-data";
import { getProviderPagePublicationReadiness } from "../../_lib/publication-readiness";

export async function getPublicationStatus() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/settings/publication",
  });
  const readiness = await getProviderPagePublicationReadiness({ supabase, providerPage });

  return {
    status: providerPage.status,
    username: providerPage.username ?? "",
    readiness,
  };
}
