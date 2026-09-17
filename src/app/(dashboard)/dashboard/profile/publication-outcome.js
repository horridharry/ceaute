// Maps the outcome of publish_provider_page / unpublish_provider_page to the
// message the provider sees. PostgreSQL is authoritative and raises a short
// reason; anything it did not anticipate becomes a generic message rather
// than raw database text.
const KNOWN_REASONS = [
  {
    match: "Suspended pages cannot be published",
    message: "Suspended pages cannot be published.",
  },
  {
    match: "Suspended pages cannot be changed",
    message: "Suspended pages cannot be changed.",
  },
  {
    match: "Publication requirements are incomplete",
    message:
      "Your page does not meet the publication requirements yet. Check the list above, then try again.",
  },
];

export function publicationFailure(error, action) {
  const text = String(error?.message ?? "");
  const known = KNOWN_REASONS.find((reason) => text.includes(reason.match));

  return {
    error: true,
    message: known ? known.message : `Could not ${action} your page. Try again in a moment.`,
  };
}

export function publicationSuccess(action) {
  return {
    error: false,
    message: action === "publish" ? "Your page is published." : "Your page is unpublished.",
  };
}
