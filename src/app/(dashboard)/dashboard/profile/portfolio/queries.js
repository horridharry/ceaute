// Read-only loaders for /dashboard/profile/portfolio. Portfolio mutations
// live in ./actions.js.
import { signStoragePaths } from "@/lib/supabase/signed-urls";
import { getSignedInProvider } from "../../_lib/provider-data";
import { BUCKET_NAME } from "./_lib/portfolio-storage";

export const getPortfolioImages = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/portfolio",
  });

  const { data: images, error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select("id, storage_path, caption, display_order, is_visible")
    .eq("provider_page_id", providerPage.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Could not load portfolio.");
  }

  // One Storage request signs every image instead of one request per image.
  const signedUrlByPath = await signStoragePaths(
    supabase,
    BUCKET_NAME,
    (images ?? []).map((image) => image.storage_path),
    60 * 60,
  );

  return (images ?? []).map((image) => ({
    ...image,
    signed_url: signedUrlByPath.get(image.storage_path) ?? "",
  }));
};
