"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { isTap } from "@/features/photo-viewing/photo-navigation";

// The ratio is provisional (approved 23 September 2026 for this pass; the
// owner will judge the height in the running app), so it lives in one place.
export const DISCOVER_HERO_ASPECT = "aspect-[4/5]";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

const ARROW_CLASS =
  "absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-sm transition-opacity duration-200 motion-reduce:transition-none focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white group-hover/hero:opacity-100 opacity-0 aria-disabled:cursor-default aria-disabled:opacity-0";

function Arrow({ direction }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "previous" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

// A Discover card's photos (approved 23 September 2026): one large photo at
// a time, swiped sideways, with dots. Up to three photos, exactly those the
// query returns; one photo gets no dots, arrows or swipe.
//
// The card is not one big link. Each photo links to the storefront for
// pointer and touch users only (tabIndex -1), and a tap opens it while a swipe
// or scroll never does (isTap). The previous and next buttons are siblings of
// those links, never inside one, so they work on their own by keyboard. The
// business name, rendered by the card, is the card's keyboard link.
export function DiscoverPhotoHero({ photos, href, name }) {
  const trackRef = useRef(null);
  const pointerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(() => new Set());
  const slides = photos.filter((url) => !failed.has(url));
  const count = slides.length;
  const current = Math.min(index, Math.max(count - 1, 0));

  const goTo = useCallback((next) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({
      left: next * track.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  if (count === 0) {
    return <span aria-hidden="true" className={`block ${DISCOVER_HERO_ASPECT} max-w-full rounded-xl bg-surface-subtle`} />;
  }

  const hasControls = count > 1;

  return (
    <div className={`group/hero relative ${DISCOVER_HERO_ASPECT} max-w-full overflow-hidden rounded-xl bg-surface-subtle`}>
      <div
        ref={trackRef}
        onPointerDown={(event) => {
          pointerRef.current = {
            x: event.clientX,
            y: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
          };
        }}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (track.clientWidth > 0) setIndex(Math.round(track.scrollLeft / track.clientWidth));
        }}
        className={`flex h-full ${hasControls ? "snap-x snap-mandatory overflow-x-auto overscroll-x-contain" : "overflow-hidden"} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {slides.map((url, slideIndex) => (
          <Link
            key={url}
            href={href}
            tabIndex={-1}
            draggable={false}
            onClick={(event) => {
              const start = pointerRef.current;
              pointerRef.current = null;
              if (!start) return;
              const tap = isTap({
                startX: start.x,
                startY: start.y,
                endX: event.clientX,
                endY: event.clientY,
                scrollDelta: (trackRef.current?.scrollLeft ?? 0) - start.scrollLeft,
              });
              if (!tap) event.preventDefault();
            }}
            className="block h-full w-full shrink-0 snap-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist. */}
            <img
              src={url}
              alt={`${name}'s work, photo ${slideIndex + 1} of ${count}`}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setFailed((previous) => new Set(previous).add(url))}
              className="h-full w-full select-none object-cover"
            />
          </Link>
        ))}
      </div>

      {hasControls ? (
        <>
          <button
            type="button"
            aria-label={`Previous photo of ${name}`}
            aria-disabled={current === 0}
            onClick={() => current > 0 && goTo(current - 1)}
            className={`left-2 ${ARROW_CLASS}`}
          >
            <Arrow direction="previous" />
          </button>
          <button
            type="button"
            aria-label={`Next photo of ${name}`}
            aria-disabled={current === count - 1}
            onClick={() => current < count - 1 && goTo(current + 1)}
            className={`right-2 ${ARROW_CLASS}`}
          >
            <Arrow direction="next" />
          </button>
          <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2 py-1">
            {slides.map((url, dotIndex) => (
              <span key={url} className={`h-1.5 w-1.5 rounded-full ${dotIndex === current ? "bg-white" : "bg-white/55"}`} />
            ))}
          </span>
          <span aria-live="polite" className="sr-only">
            {`Photo ${current + 1} of ${count}`}
          </span>
        </>
      ) : null}
    </div>
  );
}
