import { heldBookingPath } from "@/lib/bookings/held-booking-path";

export function firstSearchValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function buildCheckoutPath({
  username,
  treatmentId,
  startAt,
  addOnIds,
  state = {},
}) {
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const holdId = firstSearchValue(state.hold ?? state.booking);
  const preservedValues = {
    hold: holdId,
    checkout: firstSearchValue(state.checkout),
    session_id: firstSearchValue(state.session_id),
    next: firstSearchValue(state.next),
    payment: firstSearchValue(state.payment),
  };

  for (const [key, value] of Object.entries(preservedValues)) {
    if (value) {
      searchParams.set(key, String(value));
    }
  }

  return `/@${username}/book/${treatmentId}/checkout?${searchParams.toString()}`;
}

export function buildReturnPath({ username, treatmentId, startAt, addOnIds, holdId }) {
  return heldBookingPath({ username, treatmentId, startAt, addOnIds, holdId });
}

export function buildTimePath({ username, treatmentId, addOnIds, date = "", notice = "" }) {
  const searchParams = new URLSearchParams();

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  // The London date to open the picker on, and why the customer was sent
  // back ("taken": the time was just taken).
  if (date) {
    searchParams.set("date", date);
  }

  if (notice) {
    searchParams.set("notice", notice);
  }

  const query = searchParams.toString();
  return `/@${username}/book/${treatmentId}/time${query ? `?${query}` : ""}`;
}
