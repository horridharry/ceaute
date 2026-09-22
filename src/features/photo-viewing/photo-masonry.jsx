"use client";

import { useEffect, useRef, useState } from "react";
import { MASONRY_ROW_PX, masonryRowSpan } from "./photo-navigation";

// Masonry without stored image sizes: the grid has small fixed rows, and each
// tile measures its own rendered height (it changes once the image loads)
// and spans that many rows. CSS grid's row-major auto-placement (no "dense")
// then puts every photo in the highest free spot, leftmost first, so the
// visual order follows portfolio order, and the DOM order - which is also the
// keyboard and screen-reader order - is exactly portfolio order.
//
// Before an image loads, its tile reserves a 4:5 box, so the layout moves
// only as far as each image differs from that.
function MasonryTile({ photo, index, count, label, onOpen, onError, eager }) {
  const tileRef = useRef(null);
  const imageRef = useRef(null);
  const [span, setSpan] = useState(() => masonryRowSpan(0));
  const [aspectRatio, setAspectRatio] = useState("4 / 5");

  function applyImageSize(image) {
    if (image?.naturalWidth > 0 && image.naturalHeight > 0) {
      setAspectRatio(`${image.naturalWidth} / ${image.naturalHeight}`);
    }
  }

  // An image that finished loading before hydration (cached, or very fast)
  // never fires React's onLoad, so read its size once mounted.
  useEffect(() => {
    if (imageRef.current?.complete) applyImageSize(imageRef.current);
  }, []);

  useEffect(() => {
    const tile = tileRef.current;
    if (!tile || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSpan(masonryRowSpan(entry.contentRect.height));
    });
    observer.observe(tile);
    return () => observer.disconnect();
  }, []);

  const name = `Open photo ${index + 1} of ${count}${photo.caption ? `: ${photo.caption}` : ""}`;

  return (
    <li style={{ gridRowEnd: `span ${span}` }}>
      <button
        ref={tileRef}
        type="button"
        aria-label={name}
        onClick={(event) => onOpen(index, event.currentTarget)}
        data-photo-id={photo.id}
        className="block w-full overflow-hidden rounded-xl bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URLs. */}
        <img
          src={photo.image_url}
          alt={photo.caption || `${label}, photo ${index + 1}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          ref={imageRef}
          onLoad={(event) => applyImageSize(event.currentTarget)}
          onError={() => onError(photo)}
          style={{ aspectRatio }}
          className="block w-full object-cover"
        />
      </button>
    </li>
  );
}

export function PhotoMasonry({ photos, label = "Photos", onOpen, onPhotoError }) {
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const shown = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => !failedUrls.has(photo.image_url));

  return (
    <ul
      className="grid grid-cols-2 gap-x-3 md:grid-cols-3 lg:grid-cols-4"
      style={{ gridAutoRows: `${MASONRY_ROW_PX}px` }}
    >
      {shown.map(({ photo, index }) => (
        <MasonryTile
          key={photo.id}
          photo={photo}
          index={index}
          count={photos.length}
          label={label}
          eager={index < 4}
          onOpen={onOpen}
          onError={(failed) => {
            setFailedUrls((current) => new Set(current).add(failed.image_url));
            onPhotoError?.(failed);
          }}
        />
      ))}
    </ul>
  );
}
