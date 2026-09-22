// Pure review rules shared by the storefront preview and the All reviews
// page. No data access, so both server pages and any client code can use
// them; the query lives in ./review-queries.

// How many reviews the storefront shows before "See all N reviews".
export const REVIEWS_PREVIEW_COUNT = 3;

// The All reviews page for a provider.
export function reviewsHref(username) {
  return `/@${username}/reviews`;
}

// The newest reviews, for the storefront. The page itself shows them all.
export function reviewsPreview(reviews, count = REVIEWS_PREVIEW_COUNT) {
  return (reviews ?? []).slice(0, count);
}

// The name shown on a review: the reviewer's first name only, never their
// full name. A blank name still reads as a real, verified customer.
export function reviewerDisplayName(profile) {
  const fullName = String(profile?.full_name ?? "").trim();

  if (!fullName) {
    return "Verified customer";
  }

  return fullName.split(/\s+/)[0] || "Verified customer";
}

// What the browser receives for a review: enough for the card and the rating
// summary, and nothing that identifies the customer or their booking.
export function publicReviewFields(review) {
  return {
    rating: review.rating,
    comment: review.comment ?? "",
    created_at: review.created_at,
    reviewer_name: reviewerDisplayName(review.profile),
  };
}
