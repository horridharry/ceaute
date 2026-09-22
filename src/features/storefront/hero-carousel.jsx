"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { galleryHref, isTap } from "@/features/photo-viewing/photo-navigation";
import { paginationDots } from "./hero-pagination";

const DOT_CLASS_BY_SIZE = {
  active: "h-1.5 w-3.5 bg-white",
  regular: "h-1.5 w-1.5 bg-white/60",
  small: "h-1 w-1 bg-white/50",
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Every visible portfolio image, in portfolio order. Moving between images is
// a native horizontal swipe with scroll snapping; the pagination dots follow
// the image in view and are also buttons, and the arrow keys work once the
// images have focus. With many images the dots are a compact window of at
// most five (see paginationDots), so the row never overflows. A single image
// gets no controls. An image that fails to load is dropped, and with none
// left the hero is not shown.
//
// With a `username`, tapping the image in view opens the gallery at that
// photo. A pointer that moved, or a track that scrolled while it was down,
// was a swipe, so the link is not followed (see isTap). This is the phone and
// tablet presentation; wide screens show the Bento grid instead.
export function HeroCarousel({ images, providerName, username, className = "" }) {
  const trackRef = useRef(null);
  const pointerRef = useRef(null);
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const [index, setIndex] = useState(0);
  const slides = images.filter((image) => !failedUrls.has(image.image_url));
  const count = slides.length;
  const current = Math.min(index, Math.max(count - 1, 0));

  const goTo = useCallback((nextIndex) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({
      left: nextIndex * track.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  if (count === 0) {
    return null;
  }

  const hasControls = count > 1;
  const label = providerName ? `${providerName}'s work` : "Portfolio";

  function slideImage(image, slideIndex) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URLs.
      <img
        src={image.image_url}
        alt={image.caption || `${label}, image ${slideIndex + 1}`}
        loading={slideIndex === 0 ? "eager" : "lazy"}
        fetchPriority={slideIndex === 0 ? "high" : undefined}
        draggable={false}
        onError={() =>
          setFailedUrls((failed) => new Set(failed).add(image.image_url))
        }
        className="aspect-[4/3] w-full bg-black/5 object-cover"
      />
    );
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={`relative ${className}`}
    >
      <div
        ref={trackRef}
        // With several images the track itself is focusable, so the arrow
        // keys work without reaching for the dots.
        role={hasControls ? "group" : undefined}
        tabIndex={hasControls ? 0 : undefined}
        aria-label={hasControls ? `${label}, ${count} images` : undefined}
        onKeyDown={(event) => {
          if (!hasControls) return;
          if (event.key === "ArrowRight" && current < count - 1) {
            event.preventDefault();
            goTo(current + 1);
          } else if (event.key === "ArrowLeft" && current > 0) {
            event.preventDefault();
            goTo(current - 1);
          }
        }}
        onPointerDown={(event) => {
          pointerRef.current = {
            x: event.clientX,
            y: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
          };
        }}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (track.clientWidth > 0) {
            setIndex(Math.round(track.scrollLeft / track.clientWidth));
          }
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 sm:rounded-2xl [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((image, slideIndex) => (
          <div
            key={image.image_url}
            role="group"
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} of ${count}`}
            className="w-full shrink-0 snap-center"
          >
            {username ? (
              <Link
                href={galleryHref(username, image.id)}
                tabIndex={slideIndex === current ? undefined : -1}
                aria-label={`Open photo ${slideIndex + 1} of ${count} in the gallery`}
                draggable={false}
                onClick={(event) => {
                  const start = pointerRef.current;
                  pointerRef.current = null;
                  // A keyboard activation has no pointer; always follow it.
                  if (event.detail === 0 || !start) return;
                  const tap = isTap({
                    startX: start.x,
                    startY: start.y,
                    endX: event.clientX,
                    endY: event.clientY,
                    scrollDelta: (trackRef.current?.scrollLeft ?? 0) - start.scrollLeft,
                  });
                  if (!tap) event.preventDefault();
                }}
                className="block focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
              >
                {slideImage(image, slideIndex)}
              </Link>
            ) : (
              slideImage(image, slideIndex)
            )}
          </div>
        ))}
      </div>

      {hasControls ? (
        <>
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <div className="flex items-center rounded-full bg-black/25 px-1 backdrop-blur-sm">
              {paginationDots({ count, current }).map(({ index: dotIndex, size }) => (
                <button
                  key={dotIndex}
                  type="button"
                  aria-label={`Show image ${dotIndex + 1} of ${count}`}
                  aria-current={size === "active" ? "true" : undefined}
                  onClick={() => goTo(dotIndex)}
                  className="group grid h-6 w-6 place-items-center focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`block rounded-full transition-all group-focus-visible:ring-2 group-focus-visible:ring-white ${DOT_CLASS_BY_SIZE[size]}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <p aria-live="polite" className="sr-only">
            {`Image ${current + 1} of ${count}`}
          </p>
        </>
      ) : null}
    </section>
  );
}

// The provider's display photo; left out entirely if it fails to load.
export function ProviderPhoto({ src }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URL.
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-full bg-black/5 object-cover"
    />
  );
}
