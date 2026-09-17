// Pure helpers behind the storefront's treatment-selection bottom sheet.
// Kept free of React and routing so the price/duration arithmetic and the
// link it produces can be unit tested without rendering anything. The
// server-side hold (create_validated_booking_hold) recomputes both figures
// independently, so nothing here is trusted for payment.

export function calculateSelectionTotals({ treatment, selectedAddOns = [] }) {
  const totalPricePence =
    Number(treatment?.price_pence ?? 0) +
    selectedAddOns.reduce(
      (total, addOn) => total + Number(addOn.additional_price_pence ?? 0),
      0,
    );
  const totalDurationMinutes =
    Number(treatment?.duration_minutes ?? 0) +
    selectedAddOns.reduce(
      (total, addOn) => total + Number(addOn.additional_duration_minutes ?? 0),
      0,
    );

  return { totalPricePence, totalDurationMinutes };
}

// Builds the same `/@username/book/{treatmentId}/time?add_on=...` link the
// existing add-ons page (`book/[treatmentId]/page.jsx`) and the time page's
// "Change add-ons" link already produce, so the sheet is just a faster way
// to reach a URL the rest of the booking flow already understands.
export function buildTreatmentTimeHref({ username, treatmentId, addOnIds = [] }) {
  const searchParams = new URLSearchParams();

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const query = searchParams.toString();
  return `/@${username}/book/${treatmentId}/time${query ? `?${query}` : ""}`;
}
