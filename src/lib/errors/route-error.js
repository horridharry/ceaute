// Copy for the route-level error boundary. A server-side error reaches the
// browser with a digest in place of its message in production, but the
// message may still be present during development or for client errors and
// can be raw PostgreSQL or Stripe text. The boundary therefore never shows
// error.message; it shows fixed copy plus the digest as a support reference.
export function describeRouteError(error) {
  const digest = typeof error?.digest === "string" ? error.digest.trim() : "";

  return {
    heading: "Something went wrong",
    message:
      "Ceaute could not finish that request. If you were paying for or cancelling a booking, check your bookings before trying again.",
    reference: digest || null,
  };
}
