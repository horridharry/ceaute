"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddOnList, AddOnRow } from "@/components/ui/add-on-row";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TreatmentRow } from "@/components/ui/treatment-row";
import { ListGroup } from "@/components/templates/list-template";
import {
  formatDurationMinutes,
  formatPricePence,
} from "../_lib/public-provider-format";
import {
  buildTreatmentTimeHref,
  calculateSelectionTotals,
} from "../_lib/treatment-selection";

// The approved customer interaction (docs/product.md "Booking and
// availability"): tapping a treatment row always opens its details; tapping
// Select goes straight to availability when the treatment has no add-ons, or
// opens the same details when it does, so a description alone never forces an
// extra step. Selections persist per treatment while the page stays open.
//
// A1: the details are now a centred modal rather than a bottom sheet. One
// modal pattern in the product, not two. Nothing about the interaction or the
// link it produces changed — it still navigates to the existing
// `/@username/book/[treatmentId]/time?add_on=...` URL, which the add-ons page
// and the time page's "Change add-ons" link already produce and revalidate
// server-side.

function TreatmentDetails({
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

  return (
    <Modal
      open
      onClose={onClose}
      title={treatment.name}
      footer={
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-[14px] font-medium tabular-nums text-ink">
              {formatPricePence(totalPricePence)} ·{" "}
              {formatDurationMinutes(totalDurationMinutes)}
            </span>
            {selectedAddOns.length ? (
              <span className="truncate text-[11.5px] text-black/60">
                {treatment.name} + {selectedAddOns.length}{" "}
                {selectedAddOns.length === 1 ? "add-on" : "add-ons"}
              </span>
            ) : null}
          </div>
          <Button
            block={false}
            onClick={onContinue}
            disabled={isNavigating}
            className="ml-auto shrink-0 px-6"
          >
            Pick a time
          </Button>
        </div>
      }
    >
      <p className="text-[12.5px] text-black/50">
        {formatDurationMinutes(treatment.duration_minutes)} ·{" "}
        {formatPricePence(treatment.price_pence)}
      </p>

      {/* The one place a provider's long explainer finally has room. */}
      {treatment.description ? (
        <p className="mt-3 whitespace-pre-line text-body text-black/80">
          {treatment.description}
        </p>
      ) : null}

      {hasAddOns ? (
        <div className="mt-5 flex flex-col gap-2">
          <p className="text-label uppercase text-black/45">
            Add-ons · optional
          </p>
          <AddOnList>
            {treatment.add_ons.map((addOn) => (
              <AddOnRow
                key={addOn.id}
                name={addOn.name}
                value={addOn.id}
                checked={selectedAddOnIds.has(addOn.id)}
                onChange={() => onToggleAddOn(addOn.id)}
                delta={[
                  `+ ${formatPricePence(addOn.additional_price_pence)}`,
                  addOn.additional_duration_minutes
                    ? `+ ${formatDurationMinutes(addOn.additional_duration_minutes)}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </AddOnList>
        </div>
      ) : null}
    </Modal>
  );
}

// `limit` shows the first N treatments with no group labels — the provider
// page, where the full list would sit between the portfolio and the reviews.
// Without it the sections render in full under sticky group labels, which is
// the dedicated /@username/treatments page.
export function TreatmentSelectionList({ sections, username, limit = null }) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [openTreatmentId, setOpenTreatmentId] = useState(null);
  // Remembers what was checked for each treatment for as long as the page
  // stays open, so closing the modal without continuing and reopening the
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

  function renderRow(treatment) {
    return (
      <TreatmentRow
        key={treatment.id}
        name={treatment.name}
        meta={`${formatDurationMinutes(treatment.duration_minutes)} · ${formatPricePence(treatment.price_pence)}`}
        onOpenDetails={() => handleOpenDetails(treatment)}
        onSelect={() => handleSelect(treatment)}
      />
    );
  }

  const limited = limit
    ? sections.flatMap((section) => section.treatments).slice(0, limit)
    : null;

  return (
    <>
      {limited ? (
        <div className="flex flex-col gap-2">{limited.map(renderRow)}</div>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <ListGroup
              key={section.name ?? "ungrouped"}
              label={section.name ?? undefined}
              sticky={Boolean(section.name)}
            >
              {section.treatments.map(renderRow)}
            </ListGroup>
          ))}
        </div>
      )}

      {openTreatment ? (
        <TreatmentDetails
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
