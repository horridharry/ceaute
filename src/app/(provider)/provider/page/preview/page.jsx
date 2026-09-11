import { StorefrontPage } from "@/app/(public-provider)/[username]/_components/storefront-page";
import { buildStorefrontViewModel } from "@/app/(public-provider)/[username]/_lib/storefront-view-model";
import { getSignedInProvider } from "../../_lib/provider-data";

export default async function ProviderPagePreview() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/page/preview",
  });
  const viewModel = await buildStorefrontViewModel({ supabase, providerPage });

  return <StorefrontPage viewModel={viewModel} backHref="/provider/page" />;
}
