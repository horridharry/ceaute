import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { StorefrontPage } from "./_components/storefront-page";
import { buildStorefrontViewModel } from "./_lib/storefront-view-model";
import { getPublishedProviderPageByUsername } from "./_lib/public-provider-data";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";

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
