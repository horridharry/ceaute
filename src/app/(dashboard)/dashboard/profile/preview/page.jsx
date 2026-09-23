import Link from "next/link";
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
      {/* Pinned under the app header, so the provider always knows this is a
          preview and has a way back. */}
      <div className="sticky top-14 z-10 bg-ink text-white">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-2.5 text-sm">
          <p>
            <span className="font-semibold">Preview</span> · Not live yet
          </p>
          <Link
            href="/dashboard/settings/publication"
            className="inline-flex min-h-11 items-center rounded-lg font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Back to Publication
          </Link>
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
