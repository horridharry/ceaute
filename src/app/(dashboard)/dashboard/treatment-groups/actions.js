"use server";

// Treatment-group operations for /dashboard/treatment-groups. A group is
// private storefront organisation: it has a name, an active state, and a count
// of the treatments filed under it. It knows nothing about add-ons, and
// assigning a treatment to a group belongs to ../treatments/actions.js.

import { revalidatePath } from "next/cache";
import { getString, normalizeName } from "../_lib/form-values";
import { groupTransitionOutcome, isTransition } from "../_lib/lifecycle-outcome";
import { getSignedInProvider } from "../_lib/provider-data";

// Group names appear in the provider's own treatment picker and head the
// sections of the public treatments page, so all of them are stale once a
// group changes.
function refreshTreatmentGroupPages() {
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/treatment-groups");
  revalidatePath("/[username]", "layout");
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

// Archive, restore and delete go through ceaute.transition_treatment_group
// (202609220002), the only writer of is_active and deleted_at. PostgreSQL
// refuses to archive or delete a group while any treatment, active or
// archived, is still filed under it (CE011); nothing moves treatments
// automatically. When that happens the provider gets the list of treatments
// to move.
async function listGroupTreatments(supabase, providerPageId, groupId) {
  const { data, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select("id, name, is_active")
    .eq("provider_page_id", providerPageId)
    .eq("treatment_group_id", groupId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  return error ? [] : (data ?? []);
}

async function runGroupTransition(formData) {
  const groupId = getString(formData, "groupId");
  const transition = getString(formData, "transition");
  const name = getString(formData, "groupName") || "The group";
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatment-groups",
  });

  if (!groupId || !isTransition(transition)) {
    return { status: "error", message: "Choose a group to change.", id: groupId };
  }

  const { error } = await supabase
    .schema("ceaute")
    .rpc("transition_treatment_group", {
      target_group_id: groupId,
      requested_transition: transition,
    });

  const outcome = groupTransitionOutcome({ transition, name, error });

  if (outcome.status === "blocked") {
    return {
      ...outcome,
      id: groupId,
      transition,
      treatments: await listGroupTreatments(supabase, providerPage.id, groupId),
    };
  }

  if (outcome.status === "done") {
    refreshTreatmentGroupPages();
  }

  return { ...outcome, id: groupId, transition };
}

export async function transitionTreatmentGroup(_currentState, formData) {
  return runGroupTransition(formData);
}

// The list's Archive and Restore buttons keep their old contract (one message).
async function transitionFromListButton(formData, transition) {
  formData.set("transition", transition);
  const result = await runGroupTransition(formData);

  if (result.status === "blocked") {
    return "Move treatments to another group or No group before archiving this group.";
  }

  if (result.status !== "done") {
    return result.message;
  }

  return transition === "archive" ? "Group archived." : "Group restored.";
}

export async function archiveTreatmentGroup(_currentState, formData) {
  return transitionFromListButton(formData, "archive");
}

export async function restoreTreatmentGroup(_currentState, formData) {
  return transitionFromListButton(formData, "restore");
}
