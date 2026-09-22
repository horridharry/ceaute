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

export async function getAllTreatments() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatments",
  });

  // The category and group names used to label each treatment do not depend
  // on the treatment rows, so both lookups run alongside the treatment query
  // instead of after it.
  const [{ data: treatments, error }, options] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment")
      .select(treatmentSelect)
      .eq("provider_page_id", providerPage.id)
      .order("is_active", { ascending: false })
      .order("display_order", { ascending: true })
      .order("updated_at", { ascending: false }),
    getTreatmentFormOptionsForProvider({ supabase, providerPage }),
  ]);

  if (error) {
    throw new Error("Could not load treatments.");
  }

  return treatments.map((treatment) => decorateTreatment(treatment, options));
}
