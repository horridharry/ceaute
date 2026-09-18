import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

// The only card in the product with a photograph.
//
// The rating leads the meta line because trust is the whole problem on a
// marketplace of strangers. A provider with no reviews says so plainly rather
// than showing an empty star.
//
// Three states, not two. `reviewCount` of 0 means we know there are none and
// say so; omitting `reviewCount` means the caller has not loaded ratings at
// all, and the line is left out rather than claiming a provider is new. The
// discover search does not return ratings, and "New · no reviews yet" under a
// provider with thirty-four of them would be a lie.
export function ProviderCard({
  href,
  name,
  imageUrl,
  imageAlt = "",
  rating,
  reviewCount,
  category,
  area,
  fromPriceLabel,
  className = "",
}) {
  const ratingKnown = reviewCount != null;
  const hasReviews = ratingKnown && Number(reviewCount) > 0 && rating != null;

  return (
    <Link
      href={href}
      className={`flex flex-col overflow-hidden rounded-panel border border-black/12 bg-white transition duration-150 ease-out hover:border-black/25 ${className}`.trim()}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist.
        <img
          src={imageUrl}
          alt={imageAlt}
          className="h-[150px] w-full object-cover"
        />
      ) : (
        <div className="h-[150px] w-full bg-surface" />
      )}

      <div className="flex items-start gap-3 px-3.5 pb-3 pt-[11px]">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[16px] font-semibold tracking-[-0.025em] text-ink">
            {name}
            <LinkPendingHint />
          </span>
          {ratingKnown ? (
            <span className="text-[13px] font-medium text-ink">
              {hasReviews
                ? `★ ${rating} · ${reviewCount} ${Number(reviewCount) === 1 ? "review" : "reviews"}`
                : "New · no reviews yet"}
            </span>
          ) : null}
          <span className="truncate text-[12.5px] text-black/50">
            {[category, area].filter(Boolean).join(" · ")}
          </span>
        </div>

        {fromPriceLabel ? (
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-body-strong text-ink">{fromPriceLabel}</span>
            <span className="text-[11.5px] text-black/45">from</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
