export function normalizeUkPhoneNumber(value) {
  const compact = String(value ?? "")
    .trim()
    .replace(/[()\s.-]+/g, "");

  if (/^\+44\d{9,10}$/.test(compact)) {
    return compact;
  }

  if (/^44\d{9,10}$/.test(compact)) {
    return `+${compact}`;
  }

  if (/^0\d{9,10}$/.test(compact)) {
    return `+44${compact.slice(1)}`;
  }

  return null;
}
