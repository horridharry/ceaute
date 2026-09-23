"use server";

// Treatment operations for /dashboard/treatments. A treatment owns its own
// name, description, price, duration, discovery category and the group it is
// filed under. Treatment-group administration lives in
// ../treatment-groups/actions.js and add-ons in ../add-ons/actions.js.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOptionalId, getString } from "../_lib/form-values";
import { durationToMinutes } from "../_lib/price-duration";
import { getSignedInProvider } from "../_lib/provider-data";
import { priceToPence } from "./_lib/treatment-values";

// ceaute.ensure_treatment_group_assignable (202609220002) refuses to file a
// treatment under an archived or deleted group, even if the group changed
// state after the check above.
const GROUP_UNAVAILABLE = "Please choose one of your active treatment groups.";

function describeTreatmentSaveError(error, fallbackMessage) {
  return error.code === "CE014" ? GROUP_UNAVAILABLE : fallbackMessage;
}

function refreshTreatmentPages() {
  revalidatePath("/dashboard/treatments");
  // A bookable treatment is a publication requirement: refresh the setup
  // guide, Today and Publication with it.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/[username]", "layout");
}

async function validateTreatmentForm({
  formData,
  supabase,
  providerPage,
  currentGroupId = null,
}) {
  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const pricePence = priceToPence(formData.get("price"));
  const durationMinutes = durationToMinutes(formData.get("duration_minutes"));
  const discoveryCategoryId = getString(formData, "discovery_category_id");
  const treatmentGroupId = getOptionalId(formData, "treatment_group_id");

  if (name.length < 2) {
    return { error: "Please give your treatment a name." };
  }

  if (name.length > 140) {
    return { error: "Treatment name must be 140 characters or fewer." };
  }

  // A description is optional (approved 23 September 2026).
  if (description.length > 2000) {
    return { error: "Treatment description must be 2,000 characters or fewer." };
  }

  if (!pricePence) {
    return { error: "Please enter a valid price in pounds." };
  }

  // The minimum online payment is £1, so a treatment costs at least that.
  // PostgreSQL refuses anything less (treatment_price_at_least_one_pound).
  if (pricePence < 100) {
    return { error: "A treatment costs at least £1.00." };
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return { error: "Please enter a duration greater than zero." };
  }

  if (!discoveryCategoryId) {
    return { error: "Please choose a Ceaute discovery category." };
  }

  const { data: discoveryCategory, error: discoveryCategoryError } =
    await supabase
      .schema("ceaute")
      .from("discovery_category")
      .select("id")
      .eq("id", discoveryCategoryId)
      .eq("is_active", true)
      .maybeSingle();

  if (discoveryCategoryError) {
    return { error: "Could not check the discovery category." };
  }

  if (!discoveryCategory) {
    return { error: "Please choose an active Ceaute discovery category." };
  }

  // A treatment may only be filed under one of this provider's own active
  // groups. PostgreSQL's composite foreign key rejects another provider's
  // group; this check turns that into a usable message. A treatment that
  // already sits in a group that has since been archived may keep it: the
  // form shows that group as "(archived)" so saving never ungroups the
  // treatment silently, and the database only refuses a *move* into an
  // archived group.
  if (treatmentGroupId && treatmentGroupId !== currentGroupId) {
    const { data: treatmentGroup, error: treatmentGroupError } = await supabase
      .schema("ceaute")
      .from("treatment_group")
      .select("id")
      .eq("id", treatmentGroupId)
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .maybeSingle();

    if (treatmentGroupError) {
      return { error: "Could not check the treatment group." };
    }

    if (!treatmentGroup) {
      return { error: GROUP_UNAVAILABLE };
    }
  }

  return {
    values: {
      name,
      description: description || null,
      price_pence: pricePence,
      duration_minutes: durationMinutes,
      discovery_category_id: discoveryCategoryId,
      treatment_group_id: treatmentGroupId,
    },
  };
}

export async function createTreatment(_currentState, formData) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatments/new",
  });
  const result = await validateTreatmentForm({ formData, supabase, providerPage });

  if (result.error) {
    return result.error;
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .insert({
      ...result.values,
      provider_page_id: providerPage.id,
    });

  if (error) {
    return describeTreatmentSaveError(error, "Could not create the treatment.");
  }

  refreshTreatmentPages();
  redirect("/dashboard/treatments");
}

export async function updateTreatment(_currentState, formData) {
  const treatmentId = getString(formData, "treatmentId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/treatments/${treatmentId}/edit`,
  });

  const { data: current, error: currentError } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select("treatment_group_id")
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (currentError || !current) {
    return "Could not find that treatment.";
  }

  const result = await validateTreatmentForm({
    formData,
    supabase,
    providerPage,
    currentGroupId: current.treatment_group_id,
  });

  if (result.error) {
    return result.error;
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .update(result.values)
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return describeTreatmentSaveError(error, "Could not update the treatment.");
  }

  refreshTreatmentPages();
  redirect("/dashboard/treatments");
}

export async function archiveTreatment(_currentState, formData) {
  const treatmentId = getString(formData, "treatmentId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/treatments/${treatmentId}/edit`,
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .update({ is_active: false })
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not archive the treatment.";
  }

  refreshTreatmentPages();
  redirect("/dashboard/treatments");
}

export async function restoreTreatment(_currentState, formData) {
  const treatmentId = getString(formData, "treatmentId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/treatments/${treatmentId}/edit`,
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .update({ is_active: true })
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not restore the treatment.";
  }

  refreshTreatmentPages();
  redirect("/dashboard/treatments");
}
