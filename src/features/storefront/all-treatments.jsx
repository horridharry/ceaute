"use client";

import { useState } from "react";
import { ToggleFilterPills } from "@/components/ui/filter-pills";
import { TreatmentSelectionList } from "./treatment-selection-list";
import {
  ALL_TREATMENTS_FILTER,
  filterTreatmentSections,
  sectionHeading,
  treatmentFilterOptions,
} from "./treatment-sections";

// Group filter pills: a row of toggle buttons, one pressed at a time (the
// shared ToggleFilterPills, which scrolls sideways on a narrow screen).
function TreatmentGroupFilter({ options, value, onChange }) {
  return (
    <ToggleFilterPills
      label="Filter treatments by group"
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}

// Every active treatment under its group heading, with the group filter when
// more than one group has treatments. The filter is page state only. Picking
// a treatment opens the same details sheet and booking link as the
// storefront.
export function AllTreatments({ sections, username, bookable = true }) {
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
      <TreatmentSelectionList sections={shown} username={username} bookable={bookable} />
    </div>
  );
}
