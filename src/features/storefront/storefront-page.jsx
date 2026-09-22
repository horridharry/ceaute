import Link from "next/link";
import {
  formatPricePence,
  pluralCount,
  shouldShowReviewsSection,
  treatmentMetaLine,
} from "@/features/storefront/format";
import { TreatmentSelectionList } from "./treatment-selection-list";
import { HeroCarousel, ProviderPhoto } from "./hero-carousel";
import { BentoHero } from "./bento-hero";
import { galleryHref } from "@/features/photo-viewing/photo-navigation";
import {
  treatmentPreview,
  treatmentsHref,
  treatmentsInOrder,
} from "./treatment-sections";
import { ReviewCard } from "./review-card";
import { reviewsHref, reviewsPreview } from "./reviews";

// Average rating and review count, or a "New" pill before the first review.
function RatingSummary({ rating }) {
  if (!rating) {
    return (
      <p>
        <span className="inline-flex items-center rounded-full border border-black/10 px-2.5 py-0.5 text-xs font-semibold text-black/70">
          New
        </span>
      </p>
    );
  }

  return (
    <p className="text-sm font-medium text-black">
      <span aria-hidden="true">★ </span>
      <span className="sr-only">Rated </span>
      {rating.average}
      <span className="sr-only"> out of 5</span>{" "}
      <span className="font-normal text-black/60">({rating.countLabel})</span>
    </p>
  );
}

// Name first, then @username with the public area (never the exact
// address), then the rating. The display photo is optional and absent
// entirely when there is none.
function ProviderIdentity({ provider }) {
  const handleAndArea = [
    provider.username ? `@${provider.username}` : "",
    provider.public_area,
  ].filter(Boolean);

  return (
    <header>
      <div className="flex items-center gap-4">
        <ProviderPhoto src={provider.display_photo_url} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tighter [overflow-wrap:anywhere]">
            {provider.business_name || "Untitled provider page"}
          </h1>
          {handleAndArea.length ? (
            <p className="mt-1 text-sm text-black/60">
              {handleAndArea.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <RatingSummary rating={provider.rating} />
      </div>
      {provider.biography ? (
        <p className="mt-5 whitespace-pre-wrap text-sm">{provider.biography}</p>
      ) : null}
    </header>
  );
}

function PaymentTerms({ terms }) {
  const commitment = Number.isInteger(terms.commitment_amount_pence)
    ? formatPricePence(terms.commitment_amount_pence)
    : null;
  const paymentText =
    terms.payment_mode === "fixed_deposit"
      ? `${commitment ?? "A fixed deposit"} is paid when booking and retained after late cancellation.`
      : `Customers pay in full when booking. ${commitment ?? "The commitment amount"} is retained after late cancellation and the rest is refunded.`;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Booking terms</h2>
      <div className="rounded-xl border border-black/10 p-4 text-sm">
        <p>{paymentText}</p>
        {terms.cancellation_window_hours ? (
          <p className="mt-2 text-black/60">
            Cancellation window: {terms.cancellation_window_hours} hours
          </p>
        ) : null}
        {terms.written_policy ? (
          <p className="mt-4 whitespace-pre-wrap">{terms.written_policy}</p>
        ) : null}
      </div>
    </section>
  );
}

// The owner's preview of a card: the same layout as the bookable one
// without Book, because their preview never books.
function TreatmentCard({ treatment }) {
  return (
    <article className="rounded-xl border border-black/10 p-4">
      <h3 className="font-medium [overflow-wrap:anywhere]">{treatment.name}</h3>
      {treatment.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-black/60">
          {treatment.description}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-black/60">{treatmentMetaLine(treatment)}</p>
    </article>
  );
}

// Treatments and Reviews end with the same full-width outlined button.
const SECONDARY_BUTTON =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-black/15 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600";

// The first treatments in page order, with no group headings, and a
// full-width "See all N treatments" button below them counting every active
// treatment, not the three shown: every published page with a treatment can
// reach the full list, including one with exactly three. The owner's preview
// (no username) shows the same treatments without booking or the button,
// because the All treatments page, like booking, exists only for published
// pages.
function TreatmentsPreview({ sections, username }) {
  const treatments = treatmentPreview(sections);
  const previewSections = [{ key: "preview", treatments }];
  const total = treatmentsInOrder(sections).length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Treatments</h2>
      {username ? (
        <TreatmentSelectionList sections={previewSections} username={username} />
      ) : (
        <div className="flex flex-col gap-3">
          {treatments.map((treatment) => (
            <TreatmentCard key={treatment.id} treatment={treatment} />
          ))}
        </div>
      )}
      {username ? (
        <Link href={treatmentsHref(username)} className={`mt-2 ${SECONDARY_BUTTON}`}>
          {`See all ${pluralCount(total, "treatment")}`}
        </Link>
      ) : null}
    </section>
  );
}

// The newest reviews and a way into the full list. The rating average and
// count live in the identity section above, from this same visible-review
// list. Without a username (the owner's unpublished preview) the reviews
// still show, but nothing links out, because the All reviews page exists
// only for published pages.
function ReviewsPreview({ reviews, username }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Reviews</h2>
      <div className="flex flex-col gap-3">
        {reviewsPreview(reviews).map((review, index) => (
          <ReviewCard key={index} review={review} />
        ))}
      </div>
      {username ? (
        <Link href={reviewsHref(username)} className={`mt-2 ${SECONDARY_BUTTON}`}>
          {`See all ${pluralCount(reviews.length, "review")}`}
        </Link>
      ) : null}
    </section>
  );
}

// The provider's normal weekly hours: the days they are open, Monday first.
// Closed days, blocked dates and holidays are not shown, and these hours are
// not a promise of free appointments - the booking journey decides that.
function Availability({ hours }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Availability</h2>
      <dl className="flex flex-col gap-2 text-sm">
        {hours.map((entry) => (
          <div key={entry.weekday} className="flex justify-between gap-4">
            <dt>{entry.day}</dt>
            <dd className="text-black/60">{entry.hours}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Storefront sections are separated by thin, low-contrast rules with even
// spacing. The rules are provisional: to drop them, replace this with
// "flex flex-col gap-10".
const SECTION_STACK =
  "flex flex-col divide-y divide-black/[0.07] [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0";

const PORTFOLIO_PREVIEW_COUNT = 3;

// The first photos of the portfolio (the first one repeats the hero on
// purpose) and a way into the gallery. Without a username (the owner's
// unpublished preview) nothing links, because the gallery is public-only.
function PortfolioPreview({ photos, username }) {
  const preview = photos.slice(0, PORTFOLIO_PREVIEW_COUNT);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Portfolio</h2>
        {username ? (
          <Link
            href={galleryHref(username)}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-pink-600"
          >
            {`See all ${pluralCount(photos.length, "photo")}`}
          </Link>
        ) : null}
      </div>
      <ul className="grid grid-cols-3 gap-1">
        {preview.map((photo, index) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element -- Portfolio previews use short-lived signed storage URLs.
            <img
              src={photo.image_url}
              alt={photo.caption || `Portfolio photo ${index + 1}`}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full rounded-lg bg-black/5 object-cover"
            />
          );

          return (
            <li key={photo.id} className="min-w-0">
              {username ? (
                <Link
                  href={galleryHref(username, photo.id)}
                  aria-label={`Open portfolio photo ${index + 1} in the gallery`}
                  className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
                >
                  {img}
                </Link>
              ) : (
                img
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function StorefrontPage({ viewModel, backHref, showBackLink = true }) {
  const {
    provider,
    portfolio,
    treatment_sections: treatmentSections,
    opening_hours: openingHours = [],
  } = viewModel;
  // The owner's preview (backHref) is neither bookable nor linked to the
  // gallery or All treatments, which exist only for published pages.
  const publicView = !backHref;
  const galleryUsername = publicView ? provider.username : null;
  // Booking and the All treatments page are public-only too.
  const bookingUsername = publicView ? provider.username : null;

  // Phones and tablets: the swipeable hero, flush under the header on phones
  // and rounded in the column from sm. Wide screens: the Bento grid, wider
  // than the centred content column below it.
  return (
    <main className="container mx-auto max-w-md pb-5 sm:px-5 sm:pt-5 lg:max-w-5xl">
      {portfolio.length ? (
        <>
          <HeroCarousel
            images={portfolio}
            providerName={provider.business_name}
            username={galleryUsername}
            className="sm:mt-6 lg:hidden"
          />
          <BentoHero
            images={portfolio}
            providerName={provider.business_name}
            username={galleryUsername}
            className="hidden lg:mt-6 lg:block"
          />
        </>
      ) : null}
      <div
        className={`${SECTION_STACK} px-5 sm:px-0 lg:mx-auto lg:max-w-[25.5rem] ${
          portfolio.length ? "mt-6 lg:mt-10" : "mt-11 sm:mt-6"
        }`}
      >
        {backHref && showBackLink ? (
          <a
            href={backHref}
            className="inline-flex text-sm font-semibold text-pink-600"
          >
            Back to page settings
          </a>
        ) : null}
        <ProviderIdentity provider={provider} />

        {portfolio.length ? (
          <PortfolioPreview photos={portfolio} username={galleryUsername} />
        ) : null}

        {treatmentSections.length ? (
          <TreatmentsPreview
            sections={treatmentSections}
            username={bookingUsername}
          />
        ) : null}

        <PaymentTerms terms={viewModel.booking_terms} />

        {shouldShowReviewsSection(viewModel.reviews) ? (
          <ReviewsPreview reviews={viewModel.reviews} username={bookingUsername} />
        ) : null}

        {openingHours.length ? <Availability hours={openingHours} /> : null}
      </div>
    </main>
  );
}
