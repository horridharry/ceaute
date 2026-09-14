// Reading provider form fields. Server actions receive FormData, whose values
// are unknown until they are narrowed, so every dashboard action starts here.

export function getString(formData, key) {
  return String(formData.get(key) ?? "").trim();
}

export function getOptionalId(formData, key) {
  return getString(formData, key) || null;
}

export function getIdList(formData, key) {
  const ids = formData
    .getAll(key)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return [...new Set(ids)];
}

// Provider-facing names are compared case- and whitespace-insensitively, which
// matches the lower(btrim(name)) unique indexes in PostgreSQL.
export function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}
