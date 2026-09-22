import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import {
  PORTFOLIO_BUCKET,
  findPublishedHeroImage,
  ogImageResponse,
} from "@/features/storefront/hero-image";

// The link-preview (Open Graph) image for a provider page: the first visible
// portfolio image, the same one the storefront hero opens on. Social crawlers
// need a stable public URL, but portfolio images are private and the
// storefront only hands out one-hour signed URLs, so this route streams that
// one image itself. It serves nothing for an unpublished page, a page without
// a visible portfolio image, or any other image, and it is never cached by
// the CDN (see OG_IMAGE_CACHE_CONTROL), so a hidden image is not served from
// a cached copy. The ?v= query only versions the URL for social platforms.

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    return ogImageResponse({ heroImage: null, file: null });
  }

  const supabase = createServiceRoleClient();
  const heroImage = await findPublishedHeroImage(
    supabase,
    normalizePublicUsername(username),
  );

  if (!heroImage) {
    return ogImageResponse({ heroImage: null, file: null });
  }

  const { data: file, error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .download(heroImage.storagePath);

  return ogImageResponse({ heroImage, file: error ? null : file });
}
