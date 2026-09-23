"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClassName } from "@/components/ui/button-classes";
import { CardLink } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleFilterPills } from "@/components/ui/filter-pills";
import { Input } from "@/components/ui/input";
import { DashboardPage } from "../../_components/dashboard-page";
import { formatPrice, formatShortDuration } from "../../_lib/price-duration";
import {
  ALL_GROUPS,
  buildTreatmentListSections,
  treatmentGroupPills,
} from "../_lib/treatment-list";

const pluralise = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function TreatmentCard({ treatment }) {
  const facts = [
    formatPrice(treatment.price_pence),
    formatShortDuration(treatment.duration_minutes),
    treatment.add_on_count ? pluralise(treatment.add_on_count, "add-on") : "",
  ].filter(Boolean);

  return (
    <li>
      <CardLink href={`/dashboard/treatments/${treatment.treatmentId}/edit`} className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold [overflow-wrap:anywhere]">{treatment.name}</h3>
        <p className="line-clamp-2 text-[13px] text-ink-muted">{treatment.description}</p>
        <p className="text-[13px] tabular-nums">{facts.join(" · ")}</p>
      </CardLink>
    </li>
  );
}

function ArchivedTreatments({ treatments }) {
  if (treatments.length === 0) return null;

  return (
    <Disclosure summary={`Archived treatments (${treatments.length})`} className="mt-10">
      <ul className="flex flex-col gap-2">
        {treatments.map((treatment) => (
          <li key={treatment.treatmentId}>
            <CardLink href={`/dashboard/treatments/${treatment.treatmentId}/edit`} padding="sm" className="flex flex-col gap-0.5">
              <span className="font-semibold text-ink-muted [overflow-wrap:anywhere]">{treatment.name}</span>
              <span className="text-[13px] tabular-nums text-ink-muted">
                {[
                  treatment.treatment_group_name
                    ? `${treatment.treatment_group_name}${treatment.treatment_group_archived ? " (archived group)" : ""}`
                    : "No group",
                  formatPrice(treatment.price_pence),
                  formatShortDuration(treatment.duration_minutes),
                ].join(" · ")}
              </span>
            </CardLink>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

// Search by name and the group pills filter on the page; nothing is written.
// Selecting a treatment opens its edit screen.
export function TreatmentsUI({ treatments, groups }) {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState(ALL_GROUPS);
  const pills = treatmentGroupPills({ treatments, groups });
  const { sections, count } = buildTreatmentListSections({ treatments, groups, query, groupFilter });
  const archived = treatments.filter((treatment) => !treatment.is_active);
  const hasActive = treatments.some((treatment) => treatment.is_active);

  return (
    <DashboardPage title="Treatments" newHref="/dashboard/treatments/new">
      {hasActive ? (
        <>
          <div className="relative mt-6">
            <label htmlFor="treatment-search" className="sr-only">
              Search treatments
            </label>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-subtle">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <Input
              id="treatment-search"
              type="search"
              placeholder="Search treatments"
              className="w-full pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {pills.length ? (
            <ToggleFilterPills
              label="Filter treatments by group"
              options={pills}
              value={groupFilter}
              onChange={setGroupFilter}
              className="mt-3"
            />
          ) : null}
          <p role="status" aria-live="polite" className="mt-2 text-[13px] text-ink-muted">
            {pluralise(count, "treatment")}
          </p>

          {sections.length ? (
            sections.map((section) => (
              <section key={section.key} aria-labelledby={`section-${section.key}`} className="mt-7">
                <h2 id={`section-${section.key}`} className="text-lg font-semibold tracking-tight">
                  {section.name}
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {section.treatments.map((treatment) => (
                    <TreatmentCard key={treatment.treatmentId} treatment={treatment} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <div className="mt-6">
              <EmptyState>No treatments match “{query.trim()}”.</EmptyState>
              <button
                type="button"
                className={buttonClassName({ variant: "text" })}
                onClick={() => {
                  setQuery("");
                  setGroupFilter(ALL_GROUPS);
                  document.getElementById("treatment-search")?.focus();
                }}
              >
                Clear search
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          variant="bounded"
          className="mt-6"
          action={
            <Link href="/dashboard/treatments/new" className={buttonClassName({ variant: "secondary", size: "compact" })}>
              Add a treatment
            </Link>
          }
        >
          No treatments yet.
        </EmptyState>
      )}

      <ArchivedTreatments treatments={archived} />
    </DashboardPage>
  );
}
