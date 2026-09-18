"use client";

import { useState } from "react";

// The swipe hero from design 8b: a scroll-snapped strip with a plain `1 / 9`
// counter bottom right. No dot strip and no arrows — the locked design calls
// those an invented affordance, and a horizontal strip already reads as
// swipeable on a phone.
//
// There is no save control. The design draws one, but no favourite, save or
// wishlist exists anywhere in the schema, so it would be a button that does
// nothing.
export function StorefrontHero({ images, providerName }) {
  const [index, setIndex] = useState(0);

  if (!images.length) {
    return null;
  }

  function handleScroll(event) {
    const { scrollLeft, clientWidth } = event.currentTarget;
    const next = Math.round(scrollLeft / Math.max(clientWidth, 1));

    if (next !== index) setIndex(next);
  }

  return (
    <div className="relative">
      <div
        onScroll={handleScroll}
        className="flex h-[216px] snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((image, imageIndex) => (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist.
          <img
            key={`${image.image_url}-${imageIndex}`}
            src={image.image_url}
            alt={image.caption || `Work by ${providerName}`}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {images.length > 1 ? (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-1 text-[11.5px] font-medium tabular-nums text-white">
          {index + 1} / {images.length}
        </span>
      ) : null}
    </div>
  );
}
