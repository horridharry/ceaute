import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { signStoragePaths } from "@/lib/supabase/signed-urls";

const MAX_AREA_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 100;

export function normalizeDiscoverySearch(searchParams = {}) {
  const area = String(searchParams.area ?? "").trim();
  const category = String(searchParams.category ?? "").trim();

  if (area.length > MAX_AREA_LENGTH) {
    return {
      area: area.slice(0, MAX_AREA_LENGTH),
      category,
      error: "Area search is too long.",
    };
  }

  if (category.length > MAX_CATEGORY_LENGTH) {
    return {
      area,
      category: "",
      error: "Treatment category is not valid.",
    };
  }

  return { area, category, error: "" };
}

export async function getDiscoveryCategories() {
  const supabase = createServiceRoleClient();
  const { data: categories, error } = await supabase
    .schema("ceaute")
    .from("discovery_category")
    .select("name, slug")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Could not load treatment categories.");
  }

  return categories ?? [];
}

export async function searchPublicProviders(searchParams = {}) {
  const search = normalizeDiscoverySearch(searchParams);

  if (search.error) {
    return { search, results: [] };
  }

  const supabase = createServiceRoleClient();
  const { data: providers, error } = await supabase.schema("ceaute").rpc(
    "search_public_providers",
    {
      area_query: search.area || null,
      discovery_category_slug_query: search.category || null,
    },
  );

  if (error) {
    throw new Error("Could not search providers.");
  }

  // One Storage request signs every result's image instead of one per result.
  const signedUrlByPath = await signStoragePaths(
    supabase,
    "portfolio-images",
    (providers ?? []).map((provider) => provider.portfolio_storage_path),
    60 * 10,
  );

  const results = (providers ?? []).map((provider) => ({
    username: provider.username,
    display_name: provider.display_name ?? "Unnamed provider",
    provider_category: provider.provider_category ?? "Provider",
    public_area: provider.public_area ?? "",
    portfolio_image_url:
      signedUrlByPath.get(provider.portfolio_storage_path) ?? "",
    matching_treatments: Array.isArray(provider.matching_treatments)
      ? provider.matching_treatments
      : [],
  }));

  return { search, results };
}

