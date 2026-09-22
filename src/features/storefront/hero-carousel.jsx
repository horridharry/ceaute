"use client";

import { useCallback, useRef, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function ChevronIcon({ direction }) {
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
      <path d={direction === "previous" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

// Every visible portfolio image, in portfolio order. Swiping uses native
// scroll snapping; Previous/Next buttons and the arrow keys move one image
// at a time. At either end a button is dimmed with aria-disabled rather than
// disabled, so it keeps keyboard focus. An image that fails to load is
// dropped, and with none left the hero is not shown.
export function HeroCarousel({ images, providerName, className = "" }) {
  const trackRef = useRef(null);
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

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={`relative ${className}`}
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
    >
      <div
        ref={trackRef}
        // With several images the track itself is focusable, so the arrow
        // keys work without first reaching a button.
        role={hasControls ? "group" : undefined}
        tabIndex={hasControls ? 0 : undefined}
        aria-label={hasControls ? `${label}, ${count} images` : undefined}
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
            {/* eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URLs. */}
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
          </div>
        ))}
      </div>

      {hasControls ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            aria-disabled={current === 0}
            onClick={() => {
              if (current > 0) goTo(current - 1);
            }}
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-sm transition hover:bg-white aria-disabled:cursor-default aria-disabled:opacity-40"
          >
            <ChevronIcon direction="previous" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            aria-disabled={current === count - 1}
            onClick={() => {
              if (current < count - 1) goTo(current + 1);
            }}
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-sm transition hover:bg-white aria-disabled:cursor-default aria-disabled:opacity-40"
          >
            <ChevronIcon direction="next" />
          </button>
          <p
            aria-hidden="true"
            className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium tabular-nums text-white"
          >
            {current + 1} / {count}
          </p>
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
      className="h-16 w-16 shrink-0 rounded-full bg-black/5 object-cover"
    />
  );
}
