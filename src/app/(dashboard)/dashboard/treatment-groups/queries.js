// Read-only loaders for /dashboard/treatment-groups. Treatment-group
// mutations live in ./actions.js.

import { getSignedInProvider } from "../_lib/provider-data";

// Every group the provider can see (active and archived; deleted groups are
// hidden by row-level security), each with the treatments filed under it.
// The list shows how many there are, and a blocked archive or delete names
// them, archived ones included, because they still depend on the group.
export async function getTreatmentGroups({
  next = "/dashboard/treatment-groups",
} = {}) {
  const { supabase, providerPage } = await getSignedInProvider({ next });

  const [groupsResult, treatmentsResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment_group")
      .select("id, name, display_order, is_active, updated_at")
      .eq("provider_page_id", providerPage.id)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment")
      .select("id, name, is_active, treatment_group_id")
      .eq("provider_page_id", providerPage.id)
      .not("treatment_group_id", "is", null)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
  ]);

  if (groupsResult.error) {
    throw new Error("Could not load treatment groups.");
  }

  if (treatmentsResult.error) {
    throw new Error("Could not check treatment group usage.");
  }

  const treatmentsByGroup = new Map();
  for (const treatment of treatmentsResult.data ?? []) {
    const list = treatmentsByGroup.get(treatment.treatment_group_id) ?? [];
    list.push({ id: treatment.id, name: treatment.name, is_active: treatment.is_active });
    treatmentsByGroup.set(treatment.treatment_group_id, list);
  }

  return (groupsResult.data ?? []).map((group) => ({
    ...group,
    is_active: Boolean(group.is_active),
    treatments: treatmentsByGroup.get(group.id) ?? [],
  }));
}
