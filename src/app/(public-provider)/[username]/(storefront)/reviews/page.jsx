import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
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
    <PageContainer width="column">
      <PageHeading
        size="md"
        title="All reviews"
        back={{
          href: `/@${providerPage.username}`,
          label: providerName(providerPage),
        }}
      />
      {rating ? (
        <p className="mt-2 text-sm font-medium text-ink">
          <span aria-hidden="true">★ </span>
          <span className="sr-only">Rated </span>
          {rating.average}
          <span className="sr-only"> out of 5</span>{" "}
          <span className="font-normal text-ink-muted">({rating.countLabel})</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        {reviews.length ? (
          reviews.map((review, index) => <ReviewCard key={index} review={review} />)
        ) : (
          <EmptyState>No reviews yet.</EmptyState>
        )}
      </div>
    </PageContainer>
  );
}
