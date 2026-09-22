import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { StorefrontPage } from "@/features/storefront/storefront-page";
import { buildStorefrontViewModel } from "@/features/storefront/storefront-view-model";
import { resolveApplicationOrigin } from "@/lib/app/origin";
import {
  getPublishedHeroImage,
  getPublishedProviderPageByUsername,
} from "../_lib/public-provider-data";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
  storefrontPageMetadata,
} from "@/features/storefront/format";

function siteOrigin() {
  try {
    return resolveApplicationOrigin(process.env);
  } catch {
    // A misconfigured origin only costs the link-preview image.
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  // Shares the layout's cached lookup, so this adds no query for the page
  // itself; the hero lookup adds one small query.
  const normalizedUsername = normalizePublicUsername(username);
  const [providerPage, heroImage] = await Promise.all([
    getPublishedProviderPageByUsername(normalizedUsername),
    getPublishedHeroImage(normalizedUsername),
  ]);

  return storefrontPageMetadata({
    providerPage,
    origin: siteOrigin(),
    heroImageId: heroImage?.id ?? null,
  });
}

export default async function UsernamePage({ params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const supabase = createServiceRoleClient();
  const providerPage = await getPublishedProviderPageByUsername(decodedUsername);
  const viewModel = await buildStorefrontViewModel({ supabase, providerPage });

  return <StorefrontPage viewModel={viewModel} />;
}
