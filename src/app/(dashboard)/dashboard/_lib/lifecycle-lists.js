// Shared rules for the Active / Archived lists of add-ons and treatment
// groups. Deleted records never reach these helpers: row-level security hides
// them (202609220002).

// The filter lives in the URL (?status=archived); anything else is Active,
// which is the default.
export function lifecycleStatus(value) {
  return value === "archived" ? "archived" : "active";
}

export function splitByState(items) {
  return {
    active: items.filter((item) => item.is_active),
    archived: items.filter((item) => !item.is_active),
  };
}

export function lifecycleFilterOptions({ basePath, active, archived }) {
  return [
    { key: "active", label: "Active", href: basePath, count: active },
    { key: "archived", label: "Archived", href: `${basePath}?status=archived`, count: archived },
  ];
}

const pluralise = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// What a group row says about the treatments still filed under it. Archived
// treatments are named because they still block archiving and deleting.
export function groupTreatmentsLine(treatments) {
  const active = treatments.filter((treatment) => treatment.is_active).length;
  const archived = treatments.length - active;

  if (treatments.length === 0) return "No treatments";
  if (active === 0) return pluralise(archived, "archived treatment");
  return `${pluralise(active, "treatment")}${archived ? ` · ${archived} archived` : ""}`;
}

// "Works with" counts only treatments customers can book, so links an add-on
// keeps to archived treatments do not inflate it.
export function worksWithLine(count) {
  return `Works with ${pluralise(count, "treatment")}`;
}
