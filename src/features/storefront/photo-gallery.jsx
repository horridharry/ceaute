"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PhotoBentoGrid } from "@/features/photo-viewing/photo-bento-grid";
import { PhotoViewer } from "@/features/photo-viewing/photo-viewer";
import { photoIndexById } from "@/features/photo-viewing/photo-navigation";

// Signed image URLs last an hour. After most of that, a failed image is more
// likely an expired URL than a broken file, so the page is refreshed once to
// get fresh URLs from the server (storage paths never reach the browser).
const SIGNED_URL_REFRESH_AFTER_MS = 50 * 60 * 1000;

// The customer gallery: every visible photo in a Bento grid, and the full-screen
// viewer driven by ?photo=<id>. Opening a photo from the grid adds a history
// entry, so Back closes the viewer; moving between photos replaces it, so Back
// does not step through every photo. A direct link opens the viewer at that
// photo, and an unknown id is dropped from the URL.
//
// The URL changes through the browser's own history (pushState and
// replaceState, which Next keeps in sync with useSearchParams), not through
// the router: a router navigation re-rendered the page on the server for
// every swipe and re-signed every photo URL, so each swipe waited on the
// server and downloaded every photo again (measured 23 September 2026).
export function PhotoGallery({ photos, label }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("photo");
  const index = photoIndexById(photos, requestedId);
  const openedHere = useRef(false);
  const mountedAt = useRef(0);
  const refreshed = useRef(false);
  const closing = useRef(false);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  useEffect(() => {
    // Closed by any route (Close, Escape, or the browser's own Back).
    if (index === null) {
      openedHere.current = false;
      closing.current = false;
    }
  }, [index]);

  // The URL with ?photo set (or removed), keeping any other query parameters.
  const hrefWithPhoto = useCallback(
    (photoId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (photoId) {
        params.set("photo", photoId);
      } else {
        params.delete("photo");
      }
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  useEffect(() => {
    if (requestedId && index === null) {
      window.history.replaceState(null, "", hrefWithPhoto(null));
    }
  }, [requestedId, index, hrefWithPhoto]);

  const showPhoto = useCallback(
    (nextIndex, mode) => {
      const href = hrefWithPhoto(photos[nextIndex].id);
      if (mode === "push") {
        window.history.pushState(null, "", href);
      } else {
        window.history.replaceState(null, "", href);
      }
    },
    [hrefWithPhoto, photos],
  );

  function close() {
    // Escape can arrive as both a keydown and a dialog cancel; only the first
    // closes, so Back is never taken twice.
    if (index === null || closing.current) return;
    closing.current = true;
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", hrefWithPhoto(null));
    }
  }

  function focusTile(tileIndex) {
    const photo = photos[tileIndex];
    if (!photo) return;
    const tile = document.querySelector(
      `[data-photo-id="${CSS.escape(photo.id)}"]`,
    );
    if (tile instanceof HTMLElement) {
      tile.focus({ preventScroll: true });
      tile.scrollIntoView({ block: "nearest" });
    }
  }

  function handlePhotoError() {
    if (
      !refreshed.current &&
      Date.now() - mountedAt.current > SIGNED_URL_REFRESH_AFTER_MS
    ) {
      refreshed.current = true;
      router.refresh();
    }
  }

  if (photos.length === 0) {
    return <p className="text-sm text-black/60">No photos yet.</p>;
  }

  return (
    <>
      <PhotoBentoGrid
        photos={photos}
        label={label}
        onOpen={(tileIndex) => {
          openedHere.current = true;
          showPhoto(tileIndex, "push");
        }}
        onPhotoError={handlePhotoError}
      />
      <PhotoViewer
        photos={photos}
        index={index}
        label={label}
        onIndexChange={(nextIndex) => showPhoto(nextIndex, "replace")}
        onClose={close}
        onClosed={focusTile}
        onPhotoError={handlePhotoError}
      />
    </>
  );
}
