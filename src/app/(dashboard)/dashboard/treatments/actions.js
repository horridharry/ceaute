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

function refreshTreatmentPages() {
  revalidatePath("/dashboard/treatments");
  revalidatePath("/[username]", "layout");
}

async function validateTreatmentForm({ formData, supabase, providerPage }) {
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

  if (!description) {
    return { error: "Please add a treatment description." };
  }

  if (!pricePence) {
    return { error: "Please enter a valid price in pounds." };
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
  // group; this check turns that into a usable message.
  if (treatmentGroupId) {
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
      return { error: "Please choose one of your active treatment groups." };
    }
  }

  return {
    values: {
      name,
      description,
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
    return "Could not create the treatment.";
  }

  refreshTreatmentPages();
  redirect("/dashboard/treatments");
}

export async function updateTreatment(_currentState, formData) {
  const treatmentId = getString(formData, "treatmentId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/treatments/${treatmentId}/edit`,
  });

  const result = await validateTreatmentForm({ formData, supabase, providerPage });

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
    return "Could not update the treatment.";
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
