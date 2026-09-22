import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { StorefrontPage } from "@/features/storefront/storefront-page";
import { buildStorefrontViewModel } from "@/features/storefront/storefront-view-model";
import { getPublishedProviderPageByUsername } from "./_lib/public-provider-data";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
  storefrontMetadata,
} from "@/features/storefront/format";

export async function generateMetadata({ params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  // Shares the layout's cached lookup, so this adds no query.
  const providerPage = await getPublishedProviderPageByUsername(
    normalizePublicUsername(username),
  );

  return storefrontMetadata(providerPage);
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
