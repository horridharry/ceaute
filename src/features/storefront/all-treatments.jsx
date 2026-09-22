"use client";

import { useState } from "react";
import { TreatmentSelectionList } from "./treatment-selection-list";
import {
  ALL_TREATMENTS_FILTER,
  filterTreatmentSections,
  sectionHeading,
  treatmentFilterOptions,
} from "./treatment-sections";

// Group filter pills: a row of toggle buttons, one pressed at a time. On a
// narrow screen the row scrolls sideways on its own rather than widening the
// page.
function TreatmentGroupFilter({ options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label="Filter treatments by group"
      className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.key)}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 ${
              selected
                ? "border-black bg-black text-white"
                : "border-black/15 bg-white text-black hover:bg-black/[0.03]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Every active treatment under its group heading, with the group filter when
// more than one group has treatments. The filter is page state only. Picking
// a treatment opens the same details sheet and booking link as the
// storefront.
export function AllTreatments({ sections, username }) {
  const [filter, setFilter] = useState(ALL_TREATMENTS_FILTER);
  const options = treatmentFilterOptions(sections);
  const shown = filterTreatmentSections(sections, filter).map((section) => ({
    ...section,
    heading: sectionHeading(section, sections),
  }));
  const shownCount = shown.reduce((sum, section) => sum + section.treatments.length, 0);

  if (sections.length === 0) {
    return <p className="text-sm text-black/60">No treatments yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {options.length ? (
        <>
          <TreatmentGroupFilter options={options} value={filter} onChange={setFilter} />
          <p aria-live="polite" className="sr-only">
            {`Showing ${shownCount} ${shownCount === 1 ? "treatment" : "treatments"}`}
          </p>
        </>
      ) : null}
      <TreatmentSelectionList sections={shown} username={username} />
    </div>
  );
}
