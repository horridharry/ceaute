import {
  DetailBody,
  DetailSection,
  DetailTemplate,
} from "@/components/templates/detail-template";
import { ButtonLink } from "@/components/ui/button";
import { CommitBar } from "@/components/ui/commit-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoNotice } from "@/components/ui/notice";
import { ReviewCard } from "@/components/ui/review-card";
import { SettingRow } from "@/components/ui/setting-row";
import { StackedTopBar } from "@/components/ui/top-bar";
import {
  formatDurationMinutes,
  formatPricePence,
  shouldShowReviewsSection,
} from "../_lib/public-provider-format";
import { StorefrontHero } from "./storefront-hero";
import { TreatmentSelectionList } from "./treatment-selection";

// T2 · Detail with a hero. Design 8b, locked: identity, bio, portfolio,
// treatments, reviews, policies — in that reading order.
//
// Two sections the design draws are not here. "Similar in {city}" is deferred:
// no ranking exists and discovery has no recommendation logic. The portfolio
// and reviews "See all" links are omitted because neither destination has been
// built; the treatments link is kept because /@username/treatments has.
//
// The commit bar carries `from £x` but not "Next free" — that would mean
// running the availability calculator across the 60-day window on every view
// of every provider page, which is not worth it for one line of copy.

const TREATMENTS_ON_PAGE = 3;

function providerMeta({ provider, reviews }) {
  const average = reviews.length
    ? (
        reviews.reduce((total, review) => total + Number(review.rating), 0) /
        reviews.length
      ).toFixed(1)
    : null;

  return [
    provider.username ? `@${provider.username}` : "",
    provider.provider_category,
    provider.public_area,
    average ? `${average} (${reviews.length})` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function reviewsAverageLabel(reviews) {
  const average = (
    reviews.reduce((total, review) => total + Number(review.rating), 0) /
    reviews.length
  ).toFixed(1);

  return `${average} average · verified bookings only`;
}

function lowestTreatmentPrice(sections) {
  const prices = sections
    .flatMap((section) => section.treatments)
    .map((treatment) => Number(treatment.price_pence))
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length ? Math.min(...prices) : null;
}

function Policies({ terms, area }) {
  const commitment = Number.isInteger(terms.commitment_amount_pence)
    ? formatPricePence(terms.commitment_amount_pence)
    : null;

  return (
    <>
      <SettingRow
        title={
          terms.payment_mode === "fixed_deposit"
            ? `${commitment ?? "A fixed deposit"} deposit`
            : "Paid in full when booking"
        }
        value={
          terms.payment_mode === "fixed_deposit"
            ? "Balance paid on the day. Deposit comes off the total."
            : `${commitment ?? "The commitment amount"} is retained after a late cancellation and the rest refunded.`
        }
      />
      <SettingRow
        title={
          terms.cancellation_window_hours
            ? `Free cancellation up to ${terms.cancellation_window_hours} hours before`
            : "Cancellation window not set yet"
        }
        value={
          commitment
            ? `After that ${commitment} is retained and the rest refunded.`
            : undefined
        }
      />
      {area ? (
        <SettingRow
          title={`Home studio, ${area}`}
          value="Full address is shared once your booking is confirmed."
        />
      ) : null}
      {terms.written_policy ? (
        <InfoNotice>{terms.written_policy}</InfoNotice>
      ) : null}
    </>
  );
}

export function StorefrontPage({ viewModel, backHref }) {
  const {
    provider,
    portfolio,
    treatment_sections: treatmentSections,
    reviews,
  } = viewModel;

  const bookingEnabled = !backHref;
  const treatmentCount = treatmentSections.reduce(
    (total, section) => total + section.treatments.length,
    0,
  );
  const lowestPrice = lowestTreatmentPrice(treatmentSections);
  const treatmentsHref = `/@${provider.username}/treatments`;
  const name = provider.business_name || "Untitled provider page";

  return (
    <DetailTemplate
      nav={
        backHref ? (
          <StackedTopBar backHref={backHref} backLabel="Page settings" />
        ) : null
      }
      hero={<StorefrontHero images={portfolio} providerName={name} />}
      title={
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">{name}</span>
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-[16px] font-semibold text-ink"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        </span>
      }
      meta={providerMeta({ provider, reviews })}
      commitBar={
        bookingEnabled && treatmentCount ? (
          <CommitBar
            contextLabel={lowestPrice ? `from ${formatPricePence(lowestPrice)}` : undefined}
            contextDetail={
              treatmentCount === 1 ? "1 treatment" : `${treatmentCount} treatments`
            }
          >
            <ButtonLink href={treatmentsHref} block={false} className="px-6">
              Book
            </ButtonLink>
          </CommitBar>
        ) : null
      }
    >
      {provider.biography ? (
        <DetailBody>{provider.biography}</DetailBody>
      ) : null}

      {portfolio.length ? (
        <DetailSection heading="Portfolio" divider={Boolean(provider.biography)}>
          <p className="-mt-1 text-[12.5px] text-black/50">
            Recent sets by {name}
          </p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
            {portfolio.map((image, index) => (
              <figure
                key={`${image.image_url}-${index}`}
                className="w-[118px] shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist. */}
                <img
                  src={image.image_url}
                  alt={image.caption || `Work by ${name}`}
                  className="h-[140px] w-full rounded-row object-cover"
                />
                {image.caption ? (
                  <figcaption className="mt-1 truncate text-[11.5px] text-black/45">
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </DetailSection>
      ) : null}

      <DetailSection
        heading="Treatments"
        actionLabel={
          bookingEnabled && treatmentCount > TREATMENTS_ON_PAGE
            ? `See all ${treatmentCount}`
            : undefined
        }
        actionHref={
          bookingEnabled && treatmentCount > TREATMENTS_ON_PAGE
            ? treatmentsHref
            : undefined
        }
      >
        {treatmentCount === 0 ? (
          <EmptyState title="No treatments yet">
            This page has no active treatments to book.
          </EmptyState>
        ) : bookingEnabled ? (
          <TreatmentSelectionList
            sections={treatmentSections}
            username={provider.username}
            limit={TREATMENTS_ON_PAGE}
          />
        ) : (
          // The dashboard preview renders the same page without booking, so a
          // provider checking her own draft cannot start a booking with herself.
          <div className="flex flex-col gap-2">
            {treatmentSections
              .flatMap((section) => section.treatments)
              .slice(0, TREATMENTS_ON_PAGE)
              .map((treatment) => (
                <div
                  key={treatment.id}
                  className="flex items-center justify-between gap-3 rounded-row bg-surface px-3.5 py-[13px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body-strong text-ink">
                      {treatment.name}
                    </span>
                    <span className="text-[12.5px] text-black/60">
                      {formatDurationMinutes(treatment.duration_minutes)} ·{" "}
                      {formatPricePence(treatment.price_pence)}
                    </span>
                  </span>
                </div>
              ))}
          </div>
        )}
      </DetailSection>

      {shouldShowReviewsSection(reviews) ? (
        <DetailSection heading="Reviews">
          <p className="-mt-1 text-[12.5px] text-black/50">
            {reviewsAverageLabel(reviews)}
          </p>
          {reviews.map((review) => (
            <ReviewCard
              key={`${review.created_at}-${review.reviewer_name}`}
              reviewerFirstName={review.reviewer_name}
              rating={review.rating}
              dateLabel={new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
              }).format(new Date(review.created_at))}
              comment={review.comment}
            />
          ))}
        </DetailSection>
      ) : null}

      <DetailSection heading="Booking policies">
        <Policies terms={viewModel.booking_terms} area={provider.public_area} />
      </DetailSection>
    </DetailTemplate>
  );
}
