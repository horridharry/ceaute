"use server";

// Treatment-group operations for /dashboard/treatment-groups. A group is
// private storefront organisation: it has a name, an active state, and a count
// of the treatments filed under it. It knows nothing about add-ons, and
// assigning a treatment to a group belongs to ../treatments/actions.js.

import { revalidatePath } from "next/cache";
import { getString, normalizeName } from "../_lib/form-values";
import { getSignedInProvider } from "../_lib/provider-data";

// Group names appear in the provider's own treatment picker, so both pages are
// stale once a group changes.
function refreshTreatmentGroupPages() {
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/treatment-groups");
}

// PostgreSQL already rejects a duplicate name through
// treatment_group_provider_name_unique. Looking first only buys a clearer
// message than a constraint violation.
async function findDuplicateTreatmentGroup({
  supabase,
  providerPage,
  name,
  exceptGroupId = "",
}) {
  const { data: groups, error } = await supabase
    .schema("ceaute")
    .from("treatment_group")
    .select("id, name")
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return { error: "Could not check existing treatment groups." };
  }

  const normalizedName = normalizeName(name);
  const duplicate = (groups ?? []).find(
    (group) =>
      group.id !== exceptGroupId && normalizeName(group.name) === normalizedName,
  );

  return { duplicate };
}

export async function createTreatmentGroup(_currentState, formData) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatment-groups/new",
  });
  const name = getString(formData, "name");

  if (!name) {
    return "Please enter a group name.";
  }

  if (name.length > 100) {
    return "Group name must be 100 characters or fewer.";
  }

  const duplicateResult = await findDuplicateTreatmentGroup({
    supabase,
    providerPage,
    name,
  });

  if (duplicateResult.error) {
    return duplicateResult.error;
  }

  if (duplicateResult.duplicate) {
    return "You already have a treatment group with that name.";
  }

  const { error } = await supabase.schema("ceaute").from("treatment_group").insert({
    provider_page_id: providerPage.id,
    name,
  });

  if (error) {
    return "Could not create the treatment group.";
  }

  refreshTreatmentGroupPages();
  return "Group created.";
}

export async function renameTreatmentGroup(_currentState, formData) {
  const groupId = getString(formData, "groupId");
  const name = getString(formData, "name");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/treatment-groups/${groupId}/edit`,
  });

  if (!name) {
    return "Please enter a group name.";
  }

  if (name.length > 100) {
    return "Group name must be 100 characters or fewer.";
  }

  const duplicateResult = await findDuplicateTreatmentGroup({
    supabase,
    providerPage,
    name,
    exceptGroupId: groupId,
  });

  if (duplicateResult.error) {
    return duplicateResult.error;
  }

  if (duplicateResult.duplicate) {
    return "You already have a treatment group with that name.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment_group")
    .update({ name })
    .eq("id", groupId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not rename the treatment group.";
  }

  refreshTreatmentGroupPages();
  return "Group renamed.";
}

// Archiving is deliberately blocked while treatments still reference the group,
// so the provider tidies the treatments first. This is a message, not an
// invariant: nothing breaks if a treatment ends up in an archived group,
// because the storefront lists such a treatment as ungrouped.
export async function archiveTreatmentGroup(_currentState, formData) {
  const groupId = getString(formData, "groupId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatment-groups",
  });

  const { count, error: treatmentError } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select("id", { count: "exact", head: true })
    .eq("provider_page_id", providerPage.id)
    .eq("treatment_group_id", groupId);

  if (treatmentError) {
    return "Could not check whether this group is in use.";
  }

  if (count) {
    return "Move treatments to another group or No group before archiving this group.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment_group")
    .update({ is_active: false })
    .eq("id", groupId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not archive the treatment group.";
  }

  refreshTreatmentGroupPages();
  return "Group archived.";
}

export async function restoreTreatmentGroup(_currentState, formData) {
  const groupId = getString(formData, "groupId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatment-groups",
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment_group")
    .update({ is_active: true })
    .eq("id", groupId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not restore the treatment group.";
  }

  refreshTreatmentGroupPages();
  return "Group restored.";
}
