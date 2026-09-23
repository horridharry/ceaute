// The held page for a customer's hold: where Stripe returns them and where a
// hold is finished later. Shared by checkout and My bookings.
export function heldBookingPath({ username, treatmentId, startAt, addOnIds = [], holdId }) {
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  searchParams.set("hold", holdId);

  return `/@${username}/book/${treatmentId}/checkout?${searchParams.toString()}`;
}
