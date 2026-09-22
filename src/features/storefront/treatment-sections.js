// Pure treatment-list rules shared by the storefront preview, the All
// treatments page and its group filter. No data access, so the client filter
// can use them too; the queries live in ./treatment-queries.

// How many treatments the storefront shows before "See all treatments".
export const TREATMENT_PREVIEW_COUNT = 3;

// The All treatments page for a provider.
export function treatmentsHref(username) {
  return `/@${username}/treatments`;
}

// The key of the section holding treatments without an active group.
export const UNGROUPED_SECTION_KEY = "ungrouped";

// Only what the treatment cards, details sheet and booking link use. The
// ordering columns stay on the server.
function mapTreatment(treatment, compatibleAddOns) {
  return {
    id: treatment.id,
    name: treatment.name,
    description: treatment.description ?? "",
    price_pence: treatment.price_pence,
    duration_minutes: treatment.duration_minutes,
    add_ons: compatibleAddOns.map((addOn) => ({
      id: addOn.id,
      name: addOn.name,
      additional_price_pence: addOn.additional_price_pence,
      additional_duration_minutes: addOn.additional_duration_minutes,
    })),
  };
}

// Treatments grouped for display: one section per active group in group
// order, then the treatments with no active group. Rows arrive already
// sorted, so each section keeps the query's treatment order. Empty sections
// are dropped, so a group never appears without treatments.
export function buildTreatmentSections({ treatments, groups, addOns, compatibility }) {
  const activeAddOnById = new Map(addOns.map((addOn) => [addOn.id, addOn]));
  const addOnIdsByTreatmentId = new Map();

  for (const item of compatibility) {
    if (!activeAddOnById.has(item.treatment_add_on_id)) {
      continue;
    }

    const ids = addOnIdsByTreatmentId.get(item.treatment_id) ?? [];
    ids.push(item.treatment_add_on_id);
    addOnIdsByTreatmentId.set(item.treatment_id, ids);
  }

  const sections = groups.map((group) => ({
    key: group.id,
    name: group.name,
    treatments: [],
  }));
  const sectionByGroupId = new Map(
    groups.map((group, index) => [group.id, sections[index]]),
  );
  const ungroupedSection = {
    key: UNGROUPED_SECTION_KEY,
    name: null,
    treatments: [],
  };

  for (const treatment of treatments) {
    const compatibleAddOns = (addOnIdsByTreatmentId.get(treatment.id) ?? [])
      .map((addOnId) => activeAddOnById.get(addOnId))
      .filter(Boolean);
    const section =
      sectionByGroupId.get(treatment.treatment_group_id) ?? ungroupedSection;

    section.treatments.push(mapTreatment(treatment, compatibleAddOns));
  }

  // Add-ons follow their own order, not the order compatibility rows arrive.
  const addOnOrder = new Map(addOns.map((addOn, index) => [addOn.id, index]));
  for (const section of [...sections, ungroupedSection]) {
    for (const treatment of section.treatments) {
      treatment.add_ons.sort((a, b) => addOnOrder.get(a.id) - addOnOrder.get(b.id));
    }
  }

  return [...sections, ungroupedSection].filter(
    (section) => section.treatments.length > 0,
  );
}

// Every treatment in page order: sections in order, treatments in order
// within each. This is the order of the All treatments page read top to
// bottom.
export function treatmentsInOrder(sections) {
  return sections.flatMap((section) => section.treatments);
}

// The storefront's preview: the first treatments of that same order, across
// groups and without their headings, so the preview is always the top of the
// All treatments page.
export function treatmentPreview(sections, count = TREATMENT_PREVIEW_COUNT) {
  return treatmentsInOrder(sections).slice(0, count);
}

export function hasMoreTreatments(sections, count = TREATMENT_PREVIEW_COUNT) {
  return treatmentsInOrder(sections).length > count;
}

// Section headings on the All treatments page: the group's name, and
// "Other treatments" for treatments without a group when groups are shown
// above them. A page whose treatments have no groups shows no headings.
export function sectionHeading(section, sections) {
  if (section.name) {
    return section.name;
  }

  return sections.some((other) => other.name) ? "Other treatments" : null;
}

// The group filter: "All" and then one pill per group that has treatments,
// in group order. None at all when fewer than two groups have treatments.
// Treatments without a group have no pill of their own; they appear under
// "All".
export const ALL_TREATMENTS_FILTER = "all";

export function treatmentFilterOptions(sections) {
  const groups = sections.filter((section) => section.name);

  if (groups.length < 2) {
    return [];
  }

  return [
    { key: ALL_TREATMENTS_FILTER, label: "All" },
    ...groups.map((section) => ({ key: section.key, label: section.name })),
  ];
}

// The sections shown for a filter: all of them for "All" (or an unknown
// key), otherwise just the chosen group.
export function filterTreatmentSections(sections, filterKey) {
  if (filterKey === ALL_TREATMENTS_FILTER) {
    return sections;
  }

  const match = sections.filter((section) => section.key === filterKey);
  return match.length ? match : sections;
}
