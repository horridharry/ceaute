import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PhotoGallery } from "@/features/storefront/photo-gallery";
import { loadVisiblePortfolioPhotos } from "@/features/storefront/portfolio-photos";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { getPublishedProviderPageByUsername } from "../../_lib/public-provider-data";

// The dedicated gallery: every visible portfolio photo, in portfolio order.
// It sits in the (storefront) route group, so the group layout's published
// check runs first and a missing or unpublished provider is a real 404.

async function publishedPage(params) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  // Cached per request; the group layout has already run the same lookup.
  return getPublishedProviderPageByUsername(normalizePublicUsername(username));
}

export async function generateMetadata({ params }) {
  const providerPage = await publishedPage(params);
  const name =
    String(providerPage.display_name ?? "").trim() || `@${providerPage.username}`;

  return {
    title: `Photos · ${name} | Ceaute`,
    description: `Photos of work by ${name} on Ceaute.`,
  };
}

export default async function ProviderPhotosPage({ params }) {
  const providerPage = await publishedPage(params);
  const photos = await loadVisiblePortfolioPhotos(
    createServiceRoleClient(),
    providerPage.id,
  );
  const name =
    String(providerPage.display_name ?? "").trim() || `@${providerPage.username}`;

  return (
    <main className="container mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-5">
      <Link
        href={`/@${providerPage.username}`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-pink-600"
      >
        <span aria-hidden="true">←&nbsp;</span>
        {name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tighter">Photos</h1>
      <div className="mt-6">
        <PhotoGallery photos={photos} label={`${name}'s work`} />
      </div>
    </main>
  );
}
