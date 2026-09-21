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
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  searchParams.set("hold", holdId);

  return `/@${username}/book/${treatmentId}/checkout?${searchParams.toString()}`;
}

export function buildTimePath({ username, treatmentId, addOnIds }) {
  const searchParams = new URLSearchParams();

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const query = searchParams.toString();
  return `/@${username}/book/${treatmentId}/time${query ? `?${query}` : ""}`;
}
