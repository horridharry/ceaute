// Read-only loaders for /dashboard/treatment-groups. Treatment-group
// mutations live in ./actions.js.

import { getSignedInProvider } from "../_lib/provider-data";

export async function getTreatmentGroups({
  next = "/dashboard/treatment-groups",
} = {}) {
  const { supabase, providerPage } = await getSignedInProvider({
    next,
  });

  const [groupsResult, treatmentsResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment_group")
      .select("id, name, display_order, is_active, updated_at")
      .eq("provider_page_id", providerPage.id)
      .order("is_active", { ascending: false })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment")
      .select("treatment_group_id")
      .eq("provider_page_id", providerPage.id)
      .not("treatment_group_id", "is", null),
  ]);

  if (groupsResult.error) {
    throw new Error("Could not load treatment groups.");
  }

  if (treatmentsResult.error) {
    throw new Error("Could not check treatment group usage.");
  }

  const treatmentCounts = new Map();

  for (const treatment of treatmentsResult.data ?? []) {
    treatmentCounts.set(
      treatment.treatment_group_id,
      (treatmentCounts.get(treatment.treatment_group_id) ?? 0) + 1,
    );
  }

  return (groupsResult.data ?? []).map((group) => ({
    ...group,
    referenced_treatment_count: treatmentCounts.get(group.id) ?? 0,
  }));
}
