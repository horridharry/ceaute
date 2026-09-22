// Read-only loaders for /dashboard/profile. Profile mutations live in
// ./actions.js.
import { DISPLAY_PHOTO_BUCKET } from "@/lib/providers/display-photo";
import { signStoragePaths } from "@/lib/supabase/signed-urls";
import { getSignedInProvider } from "../_lib/provider-data";
import { providerPageToFormValues } from "./_lib/provider-page-form-values";
import { getProviderPagePublicationReadiness } from "../_lib/publication-readiness";

export const getProviderPage = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile",
  });
  const [publication, signedPhotoUrls] = await Promise.all([
    getProviderPagePublicationReadiness({ supabase, providerPage }),
    signStoragePaths(
      supabase,
      DISPLAY_PHOTO_BUCKET,
      [providerPage.display_photo_path],
      60 * 60,
    ),
  ]);

  return {
    providerPage: providerPageToFormValues(providerPage),
    publication,
    displayPhotoUrl:
      signedPhotoUrls.get(providerPage.display_photo_path) ?? null,
  };
};
