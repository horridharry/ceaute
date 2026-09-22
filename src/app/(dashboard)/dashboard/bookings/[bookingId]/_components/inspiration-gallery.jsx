"use client";

import { useState } from "react";
import { PhotoViewer } from "@/features/photo-viewing/photo-viewer";

// The customer's reference photos, read-only, each opening at full size in
// the same viewer customers use for portfolios.
export function InspirationGallery({ images }) {
  const [viewing, setViewing] = useState(null);
  const photos = images
    .filter((image) => image.signed_url)
    .map((image) => ({ id: image.id, image_url: image.signed_url, caption: "" }));

  if (photos.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-1">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              data-inspiration-id={photo.id}
              aria-label={`Inspiration photo ${index + 1} of ${photos.length}, open larger`}
              onClick={() => setViewing(index)}
              className="block aspect-square w-full rounded-md bg-surface-subtle bg-cover bg-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              style={{ backgroundImage: `url("${photo.image_url}")` }}
            />
          </li>
        ))}
      </ul>
      <PhotoViewer
        photos={photos}
        index={viewing}
        label="Inspiration photos"
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
        onClosed={(closedIndex) => {
          const photo = photos[closedIndex];
          if (photo) {
            document.querySelector(`[data-inspiration-id="${CSS.escape(photo.id)}"]`)?.focus();
          }
        }}
      />
    </>
  );
}
