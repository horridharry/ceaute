import { DISPLAY_PHOTO_BUCKET } from "@/lib/providers/display-photo";
import { logSupabaseError } from "@/lib/supabase/log-error";
import { signStoragePaths } from "@/lib/supabase/signed-urls";
import { ratingSummary } from "./format";
import { buildTreatmentSections } from "./treatment-sections";
import { treatmentQueries } from "./treatment-queries";
import {
  portfolioImagesWithSignedUrls,
  signPortfolioImages,
  visiblePortfolioQuery,
} from "./portfolio-photos";

const SIGNED_IMAGE_SECONDS = 60 * 60;

// Kept for existing callers; the rules live in ./portfolio-photos.
export { portfolioImagesWithSignedUrls };

function mapBookingTerms(settings) {
  if (!settings) {
    return {
      payment_mode: "full",
      commitment_amount_pence: null,
      cancellation_window_hours: null,
      written_policy: "",
    };
  }

  return {
    payment_mode: settings.payment_mode,
    commitment_amount_pence: settings.commitment_amount_pence,
    cancellation_window_hours: settings.cancellation_window_hours,
    written_policy: settings.written_policy ?? "",
  };
}

function reviewerDisplayName(profile) {
  const fullName = String(profile?.full_name ?? "").trim();

  if (!fullName) {
    return "Verified customer";
  }

  return fullName.split(/\s+/)[0] || "Verified customer";
}

export async function buildStorefrontViewModel({ supabase, providerPage }) {
  const treatmentQuery = treatmentQueries(supabase, providerPage.id);
  const [
    locationResult,
    portfolioResult,
    groupsResult,
    treatmentsResult,
    addOnsResult,
    compatibilityResult,
    bookingSettingsResult,
    reviewsResult,
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
    supabase
      .schema("ceaute")
      .from("provider_booking_setting")
      .select(
        "payment_mode, commitment_amount_pence, cancellation_window_hours, written_policy",
      )
      .eq("provider_page_id", providerPage.id)
      .maybeSingle(),
    supabase
      .schema("ceaute")
      .from("booking_review")
      .select("rating, comment, created_at, profile:customer_profile_id(full_name)")
      .eq("provider_page_id", providerPage.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false }),
  ]);

  const failures = Object.entries({
    location: locationResult,
    portfolio: portfolioResult,
    treatment_groups: groupsResult,
    treatments: treatmentsResult,
    add_ons: addOnsResult,
    add_on_compatibility: compatibilityResult,
    booking_settings: bookingSettingsResult,
    reviews: reviewsResult,
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
  const reviews = (reviewsResult.data ?? []).map((review) => ({
    rating: review.rating,
    comment: review.comment ?? "",
    created_at: review.created_at,
    reviewer_name: reviewerDisplayName(review.profile),
  }));

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
    booking_terms: mapBookingTerms(bookingSettingsResult.data),
    reviews,
  };
}
