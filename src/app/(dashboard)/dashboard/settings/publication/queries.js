import { getSignedInProvider } from "../../_lib/provider-data";
import { getSetupState } from "../../_lib/publication-checks";

export async function getPublicationStatus() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/settings/publication",
  });
  const setup = await getSetupState({ supabase, providerPage });

  return {
    status: providerPage.status,
    username: providerPage.username ?? "",
    setup,
  };
}
