// Read-only loaders for /dashboard/profile. Profile mutations live in
// ./actions.js.
import { getSignedInProvider } from "../_lib/provider-data";
import { providerPageToFormValues } from "./_lib/provider-page-form-values";
import { getProviderPagePublicationReadiness } from "./publication-readiness";

export const getProviderPage = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile",
  });
  const publication = await getProviderPagePublicationReadiness({
    supabase,
    providerPage,
  });

  return {
    providerPage: providerPageToFormValues(providerPage),
    publication,
  };
};
