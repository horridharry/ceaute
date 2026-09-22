import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { getPublishedHeroImage } from "../../_lib/public-provider-data";

// The link-preview (Open Graph) image for a provider page: the first visible
// portfolio image, the same one the storefront hero opens on. Social crawlers
// need a stable public URL, but portfolio images are private and the
// storefront only hands out one-hour signed URLs, so this route streams that
// one image itself. It serves nothing for an unpublished page, a page without
// a visible portfolio image, or any other image, so it exposes nothing the
// public storefront does not already show.

export const dynamic = "force-dynamic";

const PORTFOLIO_BUCKET = "portfolio-images";
const TYPE_BY_EXTENSION = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(_request, { params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    return notFound();
  }

  const heroImage = await getPublishedHeroImage(
    normalizePublicUsername(username),
  );

  if (!heroImage) {
    return notFound();
  }

  const { data: file, error } = await createServiceRoleClient()
    .storage.from(PORTFOLIO_BUCKET)
    .download(heroImage.storagePath);

  if (error || !file) {
    return notFound();
  }

  const extension = heroImage.storagePath.split(".").pop()?.toLowerCase();
  const contentType = TYPE_BY_EXTENSION[extension] ?? file.type;

  if (!contentType?.startsWith("image/")) {
    return notFound();
  }

  // A short shared cache: crawlers fetch this rarely, and a hidden or
  // replaced image should stop being served soon after.
  return new Response(file.stream(), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=600, s-maxage=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
