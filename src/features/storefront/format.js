export function hasPublicUsernamePrefix(username) {
  return decodeURIComponent(String(username ?? "")).trim().startsWith("@");
}

export function normalizePublicUsername(username) {
  return decodeURIComponent(String(username ?? ""))
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

export function formatPricePence(pricePence) {
  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pricePence ?? 0) / 100);
}

export function formatDurationMinutes(durationMinutes) {
  const minutes = Number(durationMinutes ?? 0);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours && remainingMinutes) {
    return `${hours} hr ${remainingMinutes} min`;
  }

  if (hours) {
    return `${hours} hr`;
  }

  return `${remainingMinutes} min`;
}

export function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatTimeLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  })
    .format(date)
    .toLowerCase();
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes ?? 0) * 60_000);
}

// A provider page with no visible reviews yet should not advertise that fact;
// the whole section, heading included, is omitted rather than shown empty.
// "3 photos", "1 photo": the noun with its count, for "See all ..." labels.
export function pluralCount(count, noun, plural = `${noun}s`) {
  const safe = Number.isFinite(count) ? Math.max(Math.trunc(count), 0) : 0;
  return `${safe} ${safe === 1 ? noun : plural}`;
}

// The line under a treatment card: how long it takes, what it costs, and
// whether add-ons can be chosen with it.
export function treatmentMetaLine(treatment) {
  return [
    formatDurationMinutes(treatment?.duration_minutes),
    formatPricePence(treatment?.price_pence),
    treatment?.add_ons?.length ? "Add-ons available" : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
}

export function shouldShowReviewsSection(reviews) {
  return Array.isArray(reviews) && reviews.length > 0;
}

const METADATA_DESCRIPTION_LENGTH = 160;

// Title and description for a published provider page. The description is
// the provider's own bio, shortened at a word boundary, or a plain booking
// line when there is no bio.
export function storefrontMetadata({ display_name, username, biography } = {}) {
  const name = String(display_name ?? "").trim() || `@${username ?? ""}`;
  const bio = String(biography ?? "").replace(/\s+/g, " ").trim();
  let description = `Book with ${name} on Ceaute.`;

  if (bio.length > METADATA_DESCRIPTION_LENGTH) {
    const cut = bio.slice(0, METADATA_DESCRIPTION_LENGTH - 1);
    const lastSpace = cut.lastIndexOf(" ");
    description = `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
  } else if (bio) {
    description = bio;
  }

  return { title: `${name} | Ceaute`, description };
}

// storefrontMetadata plus link-preview (Open Graph and Twitter) fields. The
// preview image is the provider's hero image, served at a stable URL by
// /@username/og-image; `heroImageId` versions that URL so a new hero image is
// not hidden behind a cached old one. With no hero image or no known site
// origin there is no image, rather than a broken one.
export function storefrontPageMetadata({ providerPage, origin, heroImageId }) {
  const { title, description } = storefrontMetadata(providerPage);
  const username = String(providerPage?.username ?? "");
  const siteOrigin = String(origin ?? "").replace(/\/+$/, "");
  const pageUrl = siteOrigin && username ? `${siteOrigin}/@${username}` : null;
  const image =
    pageUrl && heroImageId
      ? {
          url: `${pageUrl}/og-image?v=${encodeURIComponent(heroImageId)}`,
          alt: `Work by ${String(providerPage?.display_name ?? "").trim() || `@${username}`}`,
        }
      : null;

  return {
    title,
    description,
    openGraph: {
      type: "profile",
      siteName: "Ceaute",
      title,
      description,
      ...(pageUrl ? { url: pageUrl } : {}),
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

// Average rating and count for the reviews the storefront may show (the
// visible ones; every review belongs to a completed booking). Null when there
// are none, which the page shows as "New". The average is rounded to one
// decimal place.
export function ratingSummary(reviews) {
  const ratings = (reviews ?? [])
    .map((review) => Number(review?.rating))
    .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);

  if (ratings.length === 0) {
    return null;
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  const average = Math.round((total / ratings.length) * 10) / 10;

  return {
    average: average.toFixed(1),
    count: ratings.length,
    countLabel: `${ratings.length} ${ratings.length === 1 ? "review" : "reviews"}`,
  };
}
