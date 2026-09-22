import { logSupabaseError } from "@/lib/supabase/log-error";
import { publicReviewFields } from "./reviews";

// The one query behind every public view of a provider's reviews: visible
// reviews only, newest first, ending with the review's id so reviews written
// in the same second come back in the same order on every request. The
// storefront preview, its rating summary and the All reviews page all read
// through here, so they can never disagree about which reviews are public.
// The id orders the rows but is not selected: the browser never sees it.
export function visibleReviewsQuery(supabase, providerPageId) {
  return supabase
    .schema("ceaute")
    .from("booking_review")
    .select("rating, comment, created_at, profile:customer_profile_id(full_name)")
    .eq("provider_page_id", providerPageId)
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
}

export function publicReviews(rows) {
  return (rows ?? []).map(publicReviewFields);
}

// Every visible review for a published page, ready for the browser.
export async function loadVisibleReviews(supabase, providerPageId) {
  const { data, error } = await visibleReviewsQuery(supabase, providerPageId);

  if (error) {
    logSupabaseError("reviews", error);
    throw new Error("Could not load reviews.", { cause: error });
  }

  return publicReviews(data);
}
