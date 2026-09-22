import Link from "next/link";
import {
  formatDurationMinutes,
  formatPricePence,
  shouldShowReviewsSection,
} from "@/features/storefront/format";
import { TreatmentSelectionList } from "./treatment-selection-list";
import { HeroCarousel, ProviderPhoto } from "./hero-carousel";
import { BentoHero } from "./bento-hero";
import { galleryHref } from "@/features/photo-viewing/photo-navigation";

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

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 p-4 text-sm text-black/60">
      {children}
    </div>
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

function TreatmentAddOns({ addOns }) {
  if (addOns.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-black/10 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
        Compatible add-ons
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {addOns.map((addOn) => (
          <li key={addOn.name} className="text-sm">
            <span className="font-medium">{addOn.name}</span>
            <span className="text-black/60">
              {" "}
              +{formatPricePence(addOn.additional_price_pence)} · +
              {formatDurationMinutes(addOn.additional_duration_minutes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TreatmentCard({ treatment }) {
  return (
    <article className="rounded-xl border border-black/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">{treatment.name}</h3>
          {treatment.description ? (
            <p className="mt-1 text-sm text-black/60">
              {treatment.description}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right text-sm font-medium">
          <p>{formatPricePence(treatment.price_pence)}</p>
          <p className="text-black/60">
            {formatDurationMinutes(treatment.duration_minutes)}
          </p>
        </div>
      </div>
      <TreatmentAddOns addOns={treatment.add_ons} />
    </article>
  );
}

function TreatmentSections({ sections, username, bookingEnabled }) {
  if (sections.length === 0) {
    return <EmptyState>No active treatments are visible yet.</EmptyState>;
  }

  if (bookingEnabled) {
    return <TreatmentSelectionList sections={sections} username={username} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.name ?? "ungrouped"} className="flex flex-col gap-3">
          {section.name ? (
            <h2 className="text-lg font-semibold">{section.name}</h2>
          ) : null}
          {section.treatments.map((treatment) => (
            <TreatmentCard key={treatment.id} treatment={treatment} />
          ))}
        </section>
      ))}
    </div>
  );
}

function Reviews({ reviews }) {
  return (
    <div className="flex flex-col gap-3">
      {reviews.map((review) => (
        <article
          key={`${review.created_at}-${review.reviewer_name}`}
          className="rounded-xl border border-black/10 p-4 text-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold">{review.rating}/5</p>
            <p className="text-xs text-black/50">Verified booking</p>
          </div>
          {review.comment ? (
            <p className="mt-3 whitespace-pre-wrap">{review.comment}</p>
          ) : null}
          <p className="mt-3 text-xs text-black/50">
            {review.reviewer_name} ·{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date(review.created_at))}
          </p>
        </article>
      ))}
    </div>
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
            See all photos
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
  const { provider, portfolio, treatment_sections: treatmentSections } =
    viewModel;
  // The owner's preview (backHref) is neither bookable nor linked to the
  // gallery, which exists only for published pages.
  const publicView = !backHref;
  const galleryUsername = publicView ? provider.username : null;

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

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Treatments</h2>
          <TreatmentSections
            sections={treatmentSections}
            username={provider.username}
            bookingEnabled={publicView}
          />
        </section>

        <PaymentTerms terms={viewModel.booking_terms} />

        {shouldShowReviewsSection(viewModel.reviews) ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Reviews</h2>
            <Reviews reviews={viewModel.reviews} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
