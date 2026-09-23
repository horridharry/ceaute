import { DISPLAY_PHOTO_BUCKET } from "@/lib/providers/display-photo";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { signStoragePaths } from "@/lib/supabase/signed-urls";
import { ratingFromTotals } from "@/features/storefront/format";

const MAX_AREA_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 100;
const SIGNED_IMAGE_SECONDS = 60 * 10;

// Discover shows 24 providers, and "Show more" adds 24 (?shown=48). The
// database returns at most 96 in one call, so a longer list is read in pages;
// 480 is a ceiling on how much one request may ask for.
export const DISCOVER_PAGE_SIZE = 24;
const DATABASE_PAGE_LIMIT = 96;
const MAX_SHOWN = 480;

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

// How many providers to show: 24, 48, 72… from ?shown, never fewer than one
// page and never more than the ceiling.
export function normalizeShown(value) {
  const requested = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);

  if (!Number.isFinite(requested) || requested <= DISCOVER_PAGE_SIZE) {
    return DISCOVER_PAGE_SIZE;
  }

  return Math.min(MAX_SHOWN, Math.ceil(requested / DISCOVER_PAGE_SIZE) * DISCOVER_PAGE_SIZE);
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

// Every published provider with a current location and an active treatment,
// alphabetically, or those matching the search. Only public fields: the
// public area, never an address.
export async function discoverProviders(searchParams = {}) {
  const search = normalizeDiscoverySearch(searchParams);
  const shown = normalizeShown(searchParams.shown);

  if (search.error) {
    return { search, shown, total: 0, providers: [] };
  }

  const supabase = createServiceRoleClient();
  const rows = [];
  let total = 0;

  for (let offset = 0; offset < shown; offset += DATABASE_PAGE_LIMIT) {
    const { data, error } = await supabase.schema("ceaute").rpc("discover_public_providers", {
      area_query: search.area || null,
      discovery_category_slug_query: search.category || null,
      result_limit: Math.min(DATABASE_PAGE_LIMIT, shown - offset),
      result_offset: offset,
    });

    if (error) {
      console.error("Failed to load Discover providers:", error);
      throw new Error("Could not load providers.");
    }

    rows.push(...(data ?? []));
    total = Number(data?.[0]?.total_count ?? total);

    if ((data ?? []).length < Math.min(DATABASE_PAGE_LIMIT, shown - offset)) {
      break;
    }
  }

  // Two Storage requests sign every card's photos, not one per card.
  const [portfolioUrls, displayPhotoUrls] = await Promise.all([
    signStoragePaths(
      supabase,
      "portfolio-images",
      rows.flatMap((row) => row.portfolio_storage_paths ?? []),
      SIGNED_IMAGE_SECONDS,
    ),
    signStoragePaths(
      supabase,
      DISPLAY_PHOTO_BUCKET,
      rows.map((row) => row.display_photo_path),
      SIGNED_IMAGE_SECONDS,
    ),
  ]);

  const providers = rows.map((row) => ({
    username: row.username,
    display_name: row.display_name || `@${row.username}`,
    public_area: row.public_area ?? "",
    display_photo_url: displayPhotoUrls.get(row.display_photo_path) ?? null,
    photo_urls: (row.portfolio_storage_paths ?? [])
      .map((path) => portfolioUrls.get(path))
      .filter(Boolean)
      .slice(0, 3),
    rating: ratingFromTotals(row.review_count, row.rating_total),
  }));

  return { search, shown, total: rows.length ? total : 0, providers };
}
