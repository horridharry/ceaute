// Read-only loaders for /dashboard/treatments. Treatment mutations live in
// ./actions.js; treatment-group administration lives in
// ../treatment-groups/actions.js and add-ons in ../add-ons/actions.js.

import { redirect } from "next/navigation";
import { getSignedInProvider } from "../_lib/provider-data";
import { treatmentToProviderTreatment } from "./_lib/treatment-values";

const treatmentSelect = `
  id,
  provider_page_id,
  name,
  description,
  price_pence,
  duration_minutes,
  discovery_category_id,
  treatment_group_id,
  is_active,
  updated_at
`;

async function getTreatmentFormOptionsForProvider({ supabase, providerPage }) {
  const [discoveryCategoriesResult, treatmentGroupsResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("discovery_category")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment_group")
      .select("id, name")
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (discoveryCategoriesResult.error) {
    throw new Error("Could not load discovery categories.");
  }

  if (treatmentGroupsResult.error) {
    throw new Error("Could not load treatment groups.");
  }

  return {
    discoveryCategories: discoveryCategoriesResult.data ?? [],
    treatmentGroups: treatmentGroupsResult.data ?? [],
  };
}

function decorateTreatment(treatment, { discoveryCategories, treatmentGroups }) {
  const discoveryCategory = discoveryCategories.find(
    (category) => category.id === treatment.discovery_category_id,
  );
  const treatmentGroup = treatmentGroups.find(
    (group) => group.id === treatment.treatment_group_id,
  );

  return treatmentToProviderTreatment({
    ...treatment,
    discovery_category: discoveryCategory ?? null,
    treatment_group: treatmentGroup ?? null,
  });
}

export async function getTreatmentFormOptions({
  next = "/dashboard/treatments",
} = {}) {
  const { supabase, providerPage } = await getSignedInProvider({ next });

  return getTreatmentFormOptionsForProvider({ supabase, providerPage });
}

export async function getTreatment(treatmentId) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatments",
  });

  const { data: treatment, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select(treatmentSelect)
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error || !treatment) {
    redirect("/dashboard/treatments");
  }

  const options = await getTreatmentFormOptionsForProvider({
    supabase,
    providerPage,
  });

  // A treatment can sit in a group that was archived after it was filed
  // there. The form must show that group rather than fall back to "No group"
  // and ungroup the treatment on save, so it is loaded here even though the
  // picker otherwise offers active groups only.
  const archivedGroup =
    treatment.treatment_group_id &&
    !options.treatmentGroups.some((group) => group.id === treatment.treatment_group_id)
      ? await getArchivedGroup({ supabase, providerPage, groupId: treatment.treatment_group_id })
      : null;

  return {
    ...decorateTreatment(treatment, {
      ...options,
      treatmentGroups: archivedGroup
        ? [...options.treatmentGroups, archivedGroup]
        : options.treatmentGroups,
    }),
    archived_group: archivedGroup,
  };
}

async function getArchivedGroup({ supabase, providerPage, groupId }) {
  const { data, error } = await supabase
    .schema("ceaute")
    .from("treatment_group")
    .select("id, name")
    .eq("id", groupId)
    .eq("provider_page_id", providerPage.id)
    .eq("is_active", false)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the treatment's group.");
  }

  return data ?? null;
}

// The Treatments screen: every treatment, the active groups that organise
// them (in their display order), each group's name even when archived (to
// label archived treatments), and how many active add-ons each treatment
// offers. Links to archived or deleted add-ons are not counted.
export async function getAllTreatments() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatments",
  });
  const db = supabase.schema("ceaute");

  const [treatmentsResult, options, allGroupsResult, addOnsResult, compatibilityResult] =
    await Promise.all([
      db
        .from("treatment")
        .select(treatmentSelect)
        .eq("provider_page_id", providerPage.id)
        .order("display_order", { ascending: true })
        .order("updated_at", { ascending: false }),
      getTreatmentFormOptionsForProvider({ supabase, providerPage }),
      db
        .from("treatment_group")
        .select("id, name, is_active")
        .eq("provider_page_id", providerPage.id),
      db
        .from("treatment_add_on")
        .select("id")
        .eq("provider_page_id", providerPage.id)
        .eq("is_active", true),
      db
        .from("treatment_add_on_compatibility")
        .select("treatment_id, treatment_add_on_id")
        .eq("provider_page_id", providerPage.id),
    ]);

  if (treatmentsResult.error || allGroupsResult.error) {
    throw new Error("Could not load treatments.");
  }

  if (addOnsResult.error || compatibilityResult.error) {
    throw new Error("Could not load add-ons for treatments.");
  }

  const activeAddOnIds = new Set((addOnsResult.data ?? []).map((addOn) => addOn.id));
  const addOnCounts = new Map();
  for (const link of compatibilityResult.data ?? []) {
    if (!activeAddOnIds.has(link.treatment_add_on_id)) continue;
    addOnCounts.set(link.treatment_id, (addOnCounts.get(link.treatment_id) ?? 0) + 1);
  }
  const groupById = new Map((allGroupsResult.data ?? []).map((group) => [group.id, group]));

  return {
    groups: options.treatmentGroups,
    treatments: (treatmentsResult.data ?? []).map((treatment) => {
      const group = groupById.get(treatment.treatment_group_id);
      return {
        ...decorateTreatment(treatment, options),
        treatment_group_name: group?.name ?? "",
        treatment_group_archived: Boolean(group && !group.is_active),
        add_on_count: addOnCounts.get(treatment.id) ?? 0,
      };
    }),
  };
}
