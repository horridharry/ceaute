import { normalizeUsername } from "../../_lib/username";

export const PROVIDER_CATEGORIES = [
  "Nails",
  "Lashes",
  "Hair",
  "Brows",
  "Skincare",
  "Makeup",
];

const PROVIDER_CATEGORY_SET = new Set(PROVIDER_CATEGORIES);

export function providerPageValuesFromFormData(formData) {
  const displayName = String(formData.get("business_name") ?? "").trim();
  const username = normalizeUsername(formData.get("username"));
  const providerCategory = String(
    formData.get("provider_category") ?? "",
  ).trim();
  const biography = String(formData.get("biography") ?? "").trim();

  return {
    displayName,
    username,
    providerCategory,
    biography,
    providerPageValues: {
      username: username || null,
      display_name: displayName || null,
      provider_category: providerCategory || null,
      biography: biography || null,
    },
  };
}

export function isProviderCategory(value) {
  return PROVIDER_CATEGORY_SET.has(value);
}
