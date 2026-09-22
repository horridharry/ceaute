"use client";

import { useState } from "react";
import { galleryBentoTiles } from "./photo-navigation";

const GAP_PX = 4;

// Every photo in a Bento grid laid out by galleryBentoTiles. Rows are sized
// from the grid's own width (container query units) so every cell is 4:5 at
// any width without measuring images. Tiles are in portfolio order, which is
// also the tab and screen-reader order. A photo that fails to load is dropped
// and the layout recomputed, so the grid never shows a hole or a broken image.
export function PhotoBentoGrid({ photos, label = "Photos", onOpen, onPhotoError }) {
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const shown = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => !failedUrls.has(photo.image_url));
  const tiles = galleryBentoTiles(shown.length);

  return (
    <div className="@container">
      <ul
        className="grid [--gallery-cols:2] md:[--gallery-cols:4]"
        style={{
          gap: `${GAP_PX}px`,
          gridTemplateColumns: "repeat(var(--gallery-cols), minmax(0, 1fr))",
          gridAutoRows: `calc((100cqw - (var(--gallery-cols) - 1) * ${GAP_PX}px) / var(--gallery-cols) * 1.25)`,
        }}
      >
        {tiles.map(({ index: position, placement }) => {
          const { photo, index } = shown[position];
          const name = `Open photo ${index + 1} of ${photos.length}${photo.caption ? `: ${photo.caption}` : ""}`;

          return (
            <li key={photo.id} className={`min-h-0 min-w-0 ${placement}`}>
              <button
                type="button"
                aria-label={name}
                onClick={(event) => onOpen(index, event.currentTarget)}
                data-photo-id={photo.id}
                className="group block h-full w-full overflow-hidden rounded-md bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URLs. */}
                <img
                  src={photo.image_url}
                  alt={photo.caption || `${label}, photo ${index + 1}`}
                  loading={index < 4 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  onError={() => {
                    setFailedUrls((current) => new Set(current).add(photo.image_url));
                    onPhotoError?.(photo);
                  }}
                  className="h-full w-full object-cover transition duration-200 group-hover:brightness-95"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
