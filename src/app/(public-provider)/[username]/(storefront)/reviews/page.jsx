import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ReviewCard } from "@/features/storefront/review-card";
import { loadVisibleReviews } from "@/features/storefront/review-queries";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
  ratingSummary,
} from "@/features/storefront/format";
import { getPublishedProviderPageByUsername } from "../../_lib/public-provider-data";

// All reviews: every publicly visible review, newest first, with the same
// average and count the storefront shows, because both read the same visible
// reviews. It sits in the (storefront) route group, so the group layout's
// published check runs first and a missing or unpublished provider is a real
// 404 - having reviews never makes an unpublished page visible.

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
    title: `Reviews · ${name} | Ceaute`,
    description: `Reviews of ${name} from verified Ceaute bookings.`,
  };
}

export default async function ProviderReviewsPage({ params }) {
  const providerPage = await publishedPage(params);
  const reviews = await loadVisibleReviews(
    createServiceRoleClient(),
    providerPage.id,
  );
  const rating = ratingSummary(reviews);

  return (
    <main className="container mx-auto max-w-md px-5 pb-10 pt-6 lg:max-w-[25.5rem] lg:px-0">
      <Link
        href={`/@${providerPage.username}`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-pink-600"
      >
        <span aria-hidden="true">←&nbsp;</span>
        {providerName(providerPage)}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tighter">All reviews</h1>
      {rating ? (
        <p className="mt-2 text-sm font-medium text-black">
          <span aria-hidden="true">★ </span>
          <span className="sr-only">Rated </span>
          {rating.average}
          <span className="sr-only"> out of 5</span>{" "}
          <span className="font-normal text-black/60">({rating.countLabel})</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        {reviews.length ? (
          reviews.map((review, index) => <ReviewCard key={index} review={review} />)
        ) : (
          <p className="text-sm text-black/60">No reviews yet.</p>
        )}
      </div>
    </main>
  );
}
