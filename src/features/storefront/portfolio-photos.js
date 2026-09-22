import { logSupabaseError } from "@/lib/supabase/log-error";
import { signStoragePaths } from "@/lib/supabase/signed-urls";

export const PORTFOLIO_BUCKET = "portfolio-images";
const SIGNED_IMAGE_SECONDS = 60 * 60;

// The query every public view of a portfolio uses: visible images only, in
// the provider's order (display_order, then created_at). The storefront hero,
// its portfolio preview and the gallery all read through here, so they
// cannot disagree about which photos are public or in what order.
export function visiblePortfolioQuery(supabase, providerPageId) {
  return supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select("id, storage_path, caption")
    .eq("provider_page_id", providerPageId)
    .eq("is_visible", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
}

// Pairs each row with its signed URL, in the rows' order, as the photos sent
// to the browser: { id, image_url, caption }. The storage path itself is never
// included. A row whose path could not be signed is left out rather than
// rendered as an <img> with an empty src.
export function portfolioImagesWithSignedUrls(images, signedUrlByPath) {
  return images.flatMap((image) => {
    const imageUrl = signedUrlByPath.get(image.storage_path);

    return imageUrl
      ? [{ id: image.id, image_url: imageUrl, caption: image.caption ?? "" }]
      : [];
  });
}

export async function signPortfolioImages(supabase, images) {
  const signedUrlByPath = await signStoragePaths(
    supabase,
    PORTFOLIO_BUCKET,
    images.map((image) => image.storage_path),
    SIGNED_IMAGE_SECONDS,
  );

  return portfolioImagesWithSignedUrls(images, signedUrlByPath);
}

// Visible photos for a provider page, ready for the browser.
export async function loadVisiblePortfolioPhotos(supabase, providerPageId) {
  const { data, error } = await visiblePortfolioQuery(supabase, providerPageId);

  if (error) {
    logSupabaseError("portfolio photos", error);
    throw new Error("Could not load portfolio.", { cause: error });
  }

  return signPortfolioImages(supabase, data ?? []);
}
