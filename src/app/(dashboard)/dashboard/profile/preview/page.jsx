import { redirect } from "next/navigation";
import { StorefrontPage } from "@/features/storefront/storefront-page";
import { buildStorefrontViewModel } from "@/features/storefront/storefront-view-model";
import {
  PROVIDER_PREVIEW_HREF,
  viewYourPageHref,
} from "@/components/app-header/provider-menu";
import { getSignedInProvider } from "../../_lib/provider-data";

export default async function DashboardProfilePreviewPage() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/preview",
  });

  // Once the page is live, View your page is the page itself.
  const liveHref = viewYourPageHref(providerPage);
  if (liveHref !== PROVIDER_PREVIEW_HREF) {
    redirect(liveHref);
  }

  const viewModel = await buildStorefrontViewModel({ supabase, providerPage });

  return (
    <>
      <div className="container mx-auto max-w-md p-5 pb-0">
        <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3">
          <p className="text-sm font-semibold">Preview: not live yet</p>
          <p className="mt-1 text-sm text-black/60">
            Customers can&apos;t see your page until you publish it.
          </p>
        </div>
      </div>
      <StorefrontPage
        viewModel={viewModel}
        backHref="/dashboard/profile"
        showBackLink={false}
      />
    </>
  );
}
