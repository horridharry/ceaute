export function normalizeAddOnSearch(searchParams) {
  const addOns = searchParams?.add_on;
  const addOnIds = Array.isArray(addOns) ? addOns : [addOns];

  return addOnIds.filter(Boolean).map((addOnId) => String(addOnId));
}
