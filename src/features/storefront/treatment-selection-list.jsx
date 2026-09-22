"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  formatDurationMinutes,
  formatPricePence,
  treatmentMetaLine,
} from "@/features/storefront/format";
import {
  buildTreatmentTimeHref,
  calculateSelectionTotals,
} from "./treatment-selection";

// The approved customer interaction (docs/product.md "Booking and
// availability"): tapping a treatment always opens its details bottom
// sheet; tapping Book goes straight to availability when the treatment
// has no add-ons, or opens the same sheet when it does, so a description
// alone never forces an extra step. The sheet itself only ever navigates to
// the existing `/book/[treatmentId]/time?add_on=...` URL, which is what the
// add-ons page (`book/[treatmentId]/page.jsx`) and the time page's "Change
// add-ons" link already produce and revalidate server-side, so nothing
// downstream of that link needs to know a sheet exists.
//
// The card reads: name with Book beside it, then the description clamped to
// two lines, then duration, price and whether add-ons can be chosen. The
// name's button sits inside the heading (a heading inside a button loses its
// heading role) and its ::after stretches over the whole card, so tapping
// anywhere on the card still opens the details. Book is raised above that
// layer, named after the treatment because every card has one, and stays a
// full 44px tall next to a name that wraps.
function TreatmentRow({ treatment, onOpenDetails, onSelect }) {
  return (
    <article className="relative rounded-xl border border-black/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium">
          <button
            type="button"
            onClick={() => onOpenDetails(treatment)}
            className="text-left [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-pink-600"
          >
            {treatment.name}
          </button>
        </h3>
        <button
          type="button"
          onClick={() => onSelect(treatment)}
          aria-label={`Book ${treatment.name}`}
          className="relative -my-1 inline-flex min-h-11 shrink-0 items-center rounded-lg bg-pink-700 px-4 text-sm font-semibold text-white duration-200 hover:bg-pink-800"
        >
          Book
        </button>
      </div>
      {/* Two lines on the card; the details sheet has the whole text. */}
      {treatment.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-black/60">
          {treatment.description}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-black/60">{treatmentMetaLine(treatment)}</p>
    </article>
  );
}

function TreatmentDetailsSheet({
  treatment,
  selectedAddOnIds,
  onToggleAddOn,
  onClose,
  onContinue,
  isNavigating,
}) {
  const hasAddOns = treatment.add_ons.length > 0;
  const selectedAddOns = useMemo(
    () => treatment.add_ons.filter((addOn) => selectedAddOnIds.has(addOn.id)),
    [treatment.add_ons, selectedAddOnIds],
  );
  const { totalPricePence, totalDurationMinutes } = calculateSelectionTotals({
    treatment,
    selectedAddOns,
  });

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="treatment-sheet-heading"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/10" />
        <div className="flex items-start justify-between gap-4">
          <h2 id="treatment-sheet-heading" className="text-xl font-semibold">
            {treatment.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-black/50 hover:bg-black/5 hover:text-black"
          >
            ✕
          </button>
        </div>
        {treatment.description ? (
          <p className="mt-2 text-sm text-black/60">{treatment.description}</p>
        ) : null}
        <p className="mt-3 text-sm font-medium">
          {formatPricePence(treatment.price_pence)} ·{" "}
          {formatDurationMinutes(treatment.duration_minutes)}
        </p>

        {hasAddOns ? (
          <div className="mt-5 border-t border-black/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
              Add-ons
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {treatment.add_ons.map((addOn) => (
                <li key={addOn.id}>
                  <label
                    htmlFor={`sheet_add_on_${addOn.id}`}
                    className="flex items-center gap-3 text-sm"
                  >
                    <input
                      id={`sheet_add_on_${addOn.id}`}
                      type="checkbox"
                      checked={selectedAddOnIds.has(addOn.id)}
                      onChange={() => onToggleAddOn(addOn.id)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">{addOn.name}</span>
                    <span className="text-black/60">
                      +{formatPricePence(addOn.additional_price_pence)} · +
                      {formatDurationMinutes(addOn.additional_duration_minutes)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-semibold">
              Total: {formatPricePence(totalPricePence)} ·{" "}
              {formatDurationMinutes(totalDurationMinutes)}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onContinue}
          disabled={isNavigating}
          className="mt-6 w-full rounded-lg bg-pink-700 p-3 text-sm font-semibold text-white duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isNavigating ? "Continuing..." : hasAddOns ? "Choose a time" : "Book"}
        </button>
      </div>
    </div>
  );
}

// `sections` are { key, heading?, treatments }; a section without a heading
// (the storefront preview) lists its treatments with no group heading.
export function TreatmentSelectionList({ sections, username }) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [openTreatmentId, setOpenTreatmentId] = useState(null);
  // Remembers what was checked for each treatment for as long as the page
  // stays open, so closing the sheet without continuing and reopening the
  // same treatment does not lose the selection.
  const [selectionsByTreatmentId, setSelectionsByTreatmentId] = useState({});

  const openTreatment = useMemo(() => {
    for (const section of sections) {
      const match = section.treatments.find(
        (treatment) => treatment.id === openTreatmentId,
      );

      if (match) {
        return match;
      }
    }

    return null;
  }, [sections, openTreatmentId]);

  const selectedAddOnIds = useMemo(
    () => new Set(selectionsByTreatmentId[openTreatmentId] ?? []),
    [selectionsByTreatmentId, openTreatmentId],
  );

  function goToTime(treatment, addOnIds) {
    startTransition(() => {
      router.push(
        buildTreatmentTimeHref({ username, treatmentId: treatment.id, addOnIds }),
      );
    });
  }

  function handleOpenDetails(treatment) {
    setOpenTreatmentId(treatment.id);
  }

  function handleSelect(treatment) {
    if (treatment.add_ons.length === 0) {
      goToTime(treatment, []);
      return;
    }

    setOpenTreatmentId(treatment.id);
  }

  function handleToggleAddOn(addOnId) {
    setSelectionsByTreatmentId((current) => {
      const currentIds = current[openTreatmentId] ?? [];
      const nextIds = currentIds.includes(addOnId)
        ? currentIds.filter((id) => id !== addOnId)
        : [...currentIds, addOnId];

      return { ...current, [openTreatmentId]: nextIds };
    });
  }

  function handleContinue() {
    goToTime(openTreatment, [...selectedAddOnIds]);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-3">
            {section.heading ? (
              <h2 className="text-lg font-semibold">{section.heading}</h2>
            ) : null}
            {section.treatments.map((treatment) => (
              <TreatmentRow
                key={treatment.id}
                treatment={treatment}
                onOpenDetails={handleOpenDetails}
                onSelect={handleSelect}
              />
            ))}
          </section>
        ))}
      </div>
      {openTreatment ? (
        <TreatmentDetailsSheet
          treatment={openTreatment}
          selectedAddOnIds={selectedAddOnIds}
          onToggleAddOn={handleToggleAddOn}
          onClose={() => setOpenTreatmentId(null)}
          onContinue={handleContinue}
          isNavigating={isNavigating}
        />
      ) : null}
    </>
  );
}
