"use server";
import { revalidatePath } from "next/cache";
import { getSignedInProvider } from "../../_lib/provider-data";
import { getProviderPagePublicationReadiness } from "../../_lib/publication-readiness";
import { publicationFailure, publicationSuccess } from "../../_lib/publication-outcome";

// Publishing and unpublishing, moved here from Profile. Behaviour is
// unchanged: the requirements are checked here for a usable message, and
// PostgreSQL's publish_provider_page checks every one of them again.
function refreshPublicationPages() {
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/publication");
}

// Both return { error, message } so the screen can show the outcome.
export const publishPage = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/settings/publication",
  });

  if (providerPage.status === "suspended") {
    return publicationFailure({ message: "Suspended pages cannot be published." }, "publish");
  }

  const publication = await getProviderPagePublicationReadiness({ supabase, providerPage });

  if (!publication.ready) {
    return publicationFailure({ message: "Publication requirements are incomplete." }, "publish");
  }

  const { error } = await supabase.schema("ceaute").rpc("publish_provider_page");

  if (error) {
    return publicationFailure(error, "publish");
  }

  refreshPublicationPages();
  return publicationSuccess("publish");
};

export const unpublishPage = async () => {
  const { supabase } = await getSignedInProvider({
    next: "/dashboard/settings/publication",
  });

  const { error } = await supabase.schema("ceaute").rpc("unpublish_provider_page");

  if (error) {
    return publicationFailure(error, "unpublish");
  }

  refreshPublicationPages();
  return publicationSuccess("unpublish");
};
