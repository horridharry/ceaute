"use client";

import { useState } from "react";
import Link from "next/link";
import { bentoTiles, galleryHref } from "@/features/photo-viewing/photo-navigation";

// The wide-screen hero: one prominent photo and up to four supporting ones,
// laid out by bentoTiles for 1 to 5 photos. With a `username`, every photo
// opens the gallery at that photo and "Show all photos" opens the gallery;
// without one (the owner's unpublished preview) the photos are not links,
// because the gallery exists only for published pages. A photo that fails to
// load is dropped and the layout recomputed.
export function BentoHero({ images, providerName, username, className = "" }) {
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const shown = images.filter((image) => !failedUrls.has(image.image_url));
  const tiles = bentoTiles(shown.length);

  if (tiles.length === 0) {
    return null;
  }

  const label = providerName ? `${providerName}'s work` : "Portfolio";

  return (
    <section aria-label={label} className={`relative ${className}`}>
      <ul className="grid h-[26rem] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl">
        {tiles.map(({ index, placement }) => {
          const image = shown[index];
          const img = (
            // eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URLs.
            <img
              src={image.image_url}
              alt={image.caption || `${label}, photo ${index + 1}`}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              onError={() =>
                setFailedUrls((failed) => new Set(failed).add(image.image_url))
              }
              className="h-full w-full bg-black/5 object-cover transition duration-200 group-hover:brightness-95"
            />
          );

          return (
            <li key={image.id} className={`min-h-0 ${placement}`}>
              {username ? (
                <Link
                  href={galleryHref(username, image.id)}
                  aria-label={`Open photo ${index + 1} in the gallery`}
                  className="group block h-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
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
      {username ? (
        <Link
          href={galleryHref(username)}
          className="absolute bottom-4 right-4 inline-flex min-h-11 items-center rounded-lg border border-black/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
        >
          Show all photos
        </Link>
      ) : null}
    </section>
  );
}
