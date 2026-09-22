import { DISPLAY_PHOTO_BUCKET } from "@/lib/providers/display-photo";
import { logSupabaseError } from "@/lib/supabase/log-error";
import { signStoragePaths } from "@/lib/supabase/signed-urls";
import { ratingSummary } from "./format";
import { buildTreatmentSections } from "./treatment-sections";
import { treatmentQueries } from "./treatment-queries";
import { publicReviews, visibleReviewsQuery } from "./review-queries";
import { openingHoursQuery } from "./availability-queries";
import { openingHours } from "./opening-hours";
import {
  portfolioImagesWithSignedUrls,
  signPortfolioImages,
  visiblePortfolioQuery,
} from "./portfolio-photos";

const SIGNED_IMAGE_SECONDS = 60 * 60;

// Kept for existing callers; the rules live in ./portfolio-photos.
export { portfolioImagesWithSignedUrls };

export async function buildStorefrontViewModel({ supabase, providerPage }) {
  const treatmentQuery = treatmentQueries(supabase, providerPage.id);
  const [
    locationResult,
    portfolioResult,
    groupsResult,
    treatmentsResult,
    addOnsResult,
    compatibilityResult,
    reviewsResult,
    openingHoursResult,
  ] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("provider_location")
      .select("public_area")
      .eq("provider_page_id", providerPage.id)
      // A provider can save several locations. The page shows the one they are
      // working from now, which is the same row get_public_provider_location
      // returns to the public booking journey.
      .eq("is_primary", true)
      .maybeSingle(),
    visiblePortfolioQuery(supabase, providerPage.id),
    treatmentQuery.groups,
    treatmentQuery.treatments,
    treatmentQuery.addOns,
    treatmentQuery.compatibility,
    visibleReviewsQuery(supabase, providerPage.id),
    openingHoursQuery(supabase, providerPage.id),
  ]);

  const failures = Object.entries({
    location: locationResult,
    portfolio: portfolioResult,
    treatment_groups: groupsResult,
    treatments: treatmentsResult,
    add_ons: addOnsResult,
    add_on_compatibility: compatibilityResult,
    reviews: reviewsResult,
    opening_hours: openingHoursResult,
  }).filter(([, result]) => result.error);

  if (failures.length > 0) {
    for (const [query, result] of failures) {
      logSupabaseError(`storefront view model: ${query}`, result.error);
    }
    throw new Error("Could not load provider page preview.", {
      cause: failures[0][1].error,
    });
  }

  const [portfolio, signedPhotoUrls] = await Promise.all([
    signPortfolioImages(supabase, portfolioResult.data ?? []),
    signStoragePaths(
      supabase,
      DISPLAY_PHOTO_BUCKET,
      [providerPage.display_photo_path],
      SIGNED_IMAGE_SECONDS,
    ),
  ]);
  const reviews = publicReviews(reviewsResult.data);

  return {
    provider: {
      business_name: providerPage.display_name ?? "",
      username: providerPage.username ?? "",
      provider_category: providerPage.provider_category ?? "",
      biography: providerPage.biography ?? "",
      public_area: locationResult.data?.public_area ?? "",
      // Null when there is no photo or it could not be signed; the page then
      // leaves it out rather than showing a placeholder.
      display_photo_url:
        signedPhotoUrls.get(providerPage.display_photo_path) ?? null,
      rating: ratingSummary(reviews),
    },
    portfolio,
    treatment_sections: buildTreatmentSections({
      treatments: treatmentsResult.data ?? [],
      groups: groupsResult.data ?? [],
      addOns: addOnsResult.data ?? [],
      compatibility: compatibilityResult.data ?? [],
    }),
    reviews,
    opening_hours: openingHours(openingHoursResult.data),
  };
}
