import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { AllTreatments } from "@/features/storefront/all-treatments";
import { loadTreatmentSections } from "@/features/storefront/treatment-queries";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { getPublishedProviderPageByUsername } from "../../_lib/public-provider-data";

// All treatments: every active treatment, grouped, in the same order as the
// storefront's preview. It sits in the (storefront) route group, so the
// group layout's published check runs first and a missing or unpublished
// provider is a real 404.

async function publishedPage(params) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  // Cached per request; the group layout has already run the same lookup.
  return getPublishedProviderPageByUsername(normalizePublicUsername(username));
}

function providerName(providerPage) {
  return String(providerPage.display_name ?? "").trim() || `@${providerPage.username}`;
}

export async function generateMetadata({ params }) {
  const name = providerName(await publishedPage(params));

  return {
    title: `Treatments · ${name} | Ceaute`,
    description: `Treatments you can book with ${name} on Ceaute.`,
  };
}

export default async function ProviderTreatmentsPage({ params }) {
  const providerPage = await publishedPage(params);
  const sections = await loadTreatmentSections(
    createServiceRoleClient(),
    providerPage.id,
  );

  return (
    <main className="container mx-auto max-w-md px-5 pb-10 pt-6 lg:max-w-[25.5rem] lg:px-0">
      <Link
        href={`/@${providerPage.username}`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-pink-600"
      >
        <span aria-hidden="true">←&nbsp;</span>
        {providerName(providerPage)}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tighter">All treatments</h1>
      <div className="mt-6">
        <AllTreatments sections={sections} username={providerPage.username} />
      </div>
    </main>
  );
}
