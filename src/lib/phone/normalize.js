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

// "+447700900482" → "07700 900482": the national form people recognise. A
// value that is not a UK number is shown as it was stored.
export function formatUkPhoneNumber(value) {
  const normalized = normalizeUkPhoneNumber(value);

  if (!normalized) {
    return String(value ?? "").trim();
  }

  const national = `0${normalized.slice(3)}`;
  return national.length === 11 ? `${national.slice(0, 5)} ${national.slice(5)}` : national;
}
