import { StorefrontPage } from "@/features/storefront/storefront-page";
import { buildStorefrontViewModel } from "@/features/storefront/storefront-view-model";
import { getSignedInProvider } from "../../_lib/provider-data";
import { PageSectionNav } from "../../_components/page-section-nav";

export default async function DashboardProfilePreviewPage() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/preview",
  });
  const viewModel = await buildStorefrontViewModel({ supabase, providerPage });

  return (
    <>
      <div className="container max-w-md p-5 pb-0">
        <div className="mt-6">
          <PageSectionNav />
          <h2 className="mt-8 text-2xl font-semibold tracking-tighter">
            Preview
          </h2>
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
