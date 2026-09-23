// How the Treatments screen arranges active treatments: under their active
// groups in display order, with ungrouped treatments (and any left in an
// archived group) last under "Other treatments", as on the storefront.
export const ALL_GROUPS = "all";
export const OTHER_SECTION = "other";

export function buildTreatmentListSections({ treatments, groups, query = "", groupFilter = ALL_GROUPS }) {
  const needle = query.trim().toLowerCase();
  const active = treatments.filter((treatment) => treatment.is_active);
  const activeGroupIds = new Set(groups.map((group) => group.id));
  const sectionKey = (treatment) =>
    activeGroupIds.has(treatment.treatment_group_id) ? treatment.treatment_group_id : OTHER_SECTION;
  const matching = active.filter(
    (treatment) =>
      (!needle || treatment.name.toLowerCase().includes(needle)) &&
      (groupFilter === ALL_GROUPS || sectionKey(treatment) === groupFilter),
  );

  const sections = [
    ...groups.map((group) => ({ key: group.id, name: group.name })),
    { key: OTHER_SECTION, name: "Other treatments" },
  ]
    .map((section) => ({
      ...section,
      treatments: matching.filter((treatment) => sectionKey(treatment) === section.key),
    }))
    .filter((section) => section.treatments.length > 0);

  return { sections, count: matching.length };
}

// Pills for the groups that have active treatments; none when there are fewer
// than two such groups (a single pill filters nothing).
export function treatmentGroupPills({ treatments, groups }) {
  const withTreatments = groups.filter((group) =>
    treatments.some((treatment) => treatment.is_active && treatment.treatment_group_id === group.id),
  );

  return withTreatments.length < 2
    ? []
    : [{ key: ALL_GROUPS, label: "All groups" }, ...withTreatments.map((group) => ({ key: group.id, label: group.name }))];
}
