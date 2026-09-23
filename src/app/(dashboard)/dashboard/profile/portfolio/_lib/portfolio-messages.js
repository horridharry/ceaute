// Shared by the portfolio actions and the portfolio screen, so the refusal a
// provider reads is the same whichever of them catches it first.

// CE013 comes from ceaute.keep_published_portfolio_visible (202609220003).
export const LAST_VISIBLE_PHOTO_MESSAGE =
  "Your page is live and needs at least one visible photo. Add another photo first, or unpublish your page in Publication.";

export function describePortfolioChangeError(error, fallbackMessage) {
  return error?.code === "CE013" ? LAST_VISIBLE_PHOTO_MESSAGE : fallbackMessage;
}
