"use client";

import { useEffect, useRef, useState } from "react";
import {
  isSnappedTo,
  shouldLoadViewerPhoto,
  stepPhotoIndex,
  viewerKeyAction,
} from "./photo-navigation";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function Icon({ path }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

const CONTROL_CLASS =
  "grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white aria-disabled:cursor-default aria-disabled:opacity-30";

// A full-screen viewer for a list of photos, shared by the customer gallery
// and the provider's portfolio. It is controlled: `index` is the photo shown
// (null when closed), `onIndexChange` asks to show another, and `onClose`
// asks to close. `onClosed(index)` runs after the dialog has closed so the
// parent can put focus back on the photo that was showing.
//
// Swiping is a native horizontal scroll with snapping; Previous/Next,
// the arrow keys and Home/End move one photo or to either end; Escape and
// Close close it. Only the photo in view and its neighbours get a real src.
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  onClosed,
  onPhotoError,
  label = "Photos",
}) {
  const dialogRef = useRef(null);
  const trackRef = useRef(null);
  const closeRef = useRef(null);
  const settleTimer = useRef(null);
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const open = index !== null && index !== undefined && photos.length > 0;
  const count = photos.length;
  const current = open ? Math.min(Math.max(index, 0), count - 1) : 0;
  const lastIndexRef = useRef(current);

  // The photo last shown, for focus restoration after closing. Not updated
  // while closed, when `current` falls back to 0.
  useEffect(() => {
    if (open) lastIndexRef.current = current;
  }, [open, current]);

  // Open and close the native dialog with `open`.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
      const track = trackRef.current;
      if (track) {
        track.scrollTo({ left: current * track.clientWidth, behavior: "auto" });
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // Opening jumps straight to the photo; later moves are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the track on the current photo when it changes from a button, a
  // key or the URL.
  useEffect(() => {
    const track = trackRef.current;
    if (!open || !track || track.clientWidth === 0) return;
    const target = current * track.clientWidth;
    if (Math.abs(track.scrollLeft - target) > 1) {
      track.scrollTo({
        left: target,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  }, [open, current]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  function go(action) {
    if (action === "close") {
      onClose();
      return;
    }
    const next =
      action === "first"
        ? 0
        : action === "last"
          ? count - 1
          : stepPhotoIndex(current, action === "previous" ? -1 : 1, count);
    if (next !== null && next !== current) {
      onIndexChange(next);
    }
  }

  const photo = open ? photos[current] : null;
  const hasControls = count > 1;

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onCancel={(event) => {
        // Escape: close through the parent so the URL and state follow.
        event.preventDefault();
        onClose();
      }}
      onClose={() => onClosed?.(lastIndexRef.current)}
      onKeyDown={(event) => {
        const action = viewerKeyAction(event.key);
        if (!action) return;
        if (action !== "close" && !hasControls) return;
        event.preventDefault();
        go(action);
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between gap-4 px-3">
            <p aria-live="polite" className="text-sm tabular-nums text-white/80">
              {`Photo ${current + 1} of ${count}`}
            </p>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={CONTROL_CLASS}
            >
              <Icon path="M6 6l12 12M18 6L6 18" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={trackRef}
              onScroll={(event) => {
                const track = event.currentTarget;
                clearTimeout(settleTimer.current);
                settleTimer.current = setTimeout(() => {
                  if (track.clientWidth === 0) return;
                  const settled = Math.round(track.scrollLeft / track.clientWidth);
                  // Only a track that has come to rest on a photo counts. A
                  // smooth scroll that pauses part-way (a background tab)
                  // must not pull the viewer back to the photo it was
                  // leaving.
                  if (!isSnappedTo(track.scrollLeft, settled, track.clientWidth)) return;
                  if (settled !== lastIndexRef.current) onIndexChange(settled);
                }, 120);
              }}
              className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((item, itemIndex) => (
                <div
                  key={item.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${itemIndex + 1} of ${count}`}
                  aria-hidden={itemIndex === current ? undefined : true}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center p-2 sm:p-6"
                >
                  {failedUrls.has(item.image_url) ? (
                    <p className="px-6 text-center text-sm text-white/70">
                      This photo could not be loaded.
                    </p>
                  ) : shouldLoadViewerPhoto(itemIndex, current) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URLs.
                    <img
                      src={item.image_url}
                      alt={item.caption || `${label}, photo ${itemIndex + 1}`}
                      decoding="async"
                      draggable={false}
                      onError={() => {
                        setFailedUrls((failed) => new Set(failed).add(item.image_url));
                        onPhotoError?.(item);
                      }}
                      className="max-h-full max-w-full select-none object-contain"
                    />
                  ) : null}
                </div>
              ))}
            </div>

            {hasControls ? (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  aria-disabled={current === 0}
                  onClick={() => go("previous")}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 ${CONTROL_CLASS}`}
                >
                  <Icon path="M15 6l-6 6 6 6" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  aria-disabled={current === count - 1}
                  onClick={() => go("next")}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${CONTROL_CLASS}`}
                >
                  <Icon path="M9 6l6 6-6 6" />
                </button>
              </>
            ) : null}
          </div>

          {photo?.caption ? (
            <p className="shrink-0 px-4 pb-4 text-center text-sm text-white/80">
              {photo.caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
