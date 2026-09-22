// The provider's hero image as used for link previews: the first visible
// portfolio image of a published page, in the storefront's own order
// (display_order, then created_at). Kept free of server-only imports so the
// rules can be tested with a fake client.

import { logSupabaseError } from "@/lib/supabase/log-error";

export const PORTFOLIO_BUCKET = "portfolio-images";

const TYPE_BY_EXTENSION = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// No shared (CDN) caching. Every request re-checks that the page is published
// and which image is currently first and visible, so an image the provider
// hides, deletes or reorders stops being served by this endpoint at once
// rather than when a cached copy expires. Crawlers fetch preview images
// rarely, so this costs little. (Social platforms keep their own copies,
// which is outside Ceaute's control.)
export const OG_IMAGE_CACHE_CONTROL = "private, no-store, max-age=0";

// Null when the page is not published or shows no visible portfolio image.
export async function findPublishedHeroImage(supabase, normalizedUsername) {
  if (!normalizedUsername) {
    return null;
  }

  const { data: providerPage, error: pageError } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .select("id, username")
    .eq("username", normalizedUsername)
    .eq("status", "published")
    .maybeSingle();

  if (pageError) {
    logSupabaseError("hero image: provider page lookup", pageError);
    throw new Error("Could not load provider page.", { cause: pageError });
  }

  if (!providerPage) {
    return null;
  }

  const { data: image, error: imageError } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select("id, storage_path")
    .eq("provider_page_id", providerPage.id)
    .eq("is_visible", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (imageError) {
    logSupabaseError("hero image: portfolio lookup", imageError);
    throw new Error("Could not load portfolio image.", { cause: imageError });
  }

  return image
    ? {
        id: image.id,
        storagePath: image.storage_path,
        username: providerPage.username,
      }
    : null;
}

function notFoundResponse() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": OG_IMAGE_CACHE_CONTROL },
  });
}

// The endpoint's response for a hero image (or null) and the file downloaded
// for it (or null). Anything that is not an image of an allowed type is 404.
export function ogImageResponse({ heroImage, file }) {
  if (!heroImage || !file) {
    return notFoundResponse();
  }

  const extension = heroImage.storagePath.split(".").pop()?.toLowerCase();
  const contentType = TYPE_BY_EXTENSION[extension];

  if (!contentType) {
    return notFoundResponse();
  }

  return new Response(file.stream(), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(file.size),
      "Cache-Control": OG_IMAGE_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
