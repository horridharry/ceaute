"use server";

// Add-on operations for /dashboard/add-ons, including which treatments each
// add-on may be booked with. Compatibility is written nowhere else: both saves
// go through a PostgreSQL function so the add-on and its compatible treatments
// change in one transaction.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getIdList, getString } from "../_lib/form-values";
import {
  durationToMinutes,
  getSignedInProvider,
  nonNegativePriceToPence,
  penceToPrice,
} from "../_lib/provider-data";

const addOnSelect =
  "id, name, additional_price_pence, additional_duration_minutes, is_active, updated_at";

// An add-on is shown on its own page and against every treatment that accepts
// it, so a change makes both provider pages stale.
function refreshAddOnPages() {
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/add-ons");
}

function parseAddOnForm(formData) {
  const name = getString(formData, "name");
  const additionalPricePence = nonNegativePriceToPence(
    formData.get("additional_price"),
  );
  const additionalDurationMinutes = durationToMinutes(
    formData.get("additional_duration_minutes"),
  );

  if (!name) {
    return { error: "Please enter an add-on name." };
  }

  if (name.length > 100) {
    return { error: "Add-on name must be 100 characters or fewer." };
  }

  if (additionalPricePence === null) {
    return { error: "Please enter a valid additional price in pounds." };
  }

  if (
    !Number.isInteger(additionalDurationMinutes) ||
    additionalDurationMinutes < 0
  ) {
    return { error: "Additional duration must be zero or more whole minutes." };
  }

  if (additionalPricePence === 0 && additionalDurationMinutes === 0) {
    return { error: "Add-ons must increase the price, duration or both." };
  }

  return {
    values: {
      name,
      additionalPricePence,
      additionalDurationMinutes,
      // The database deduplicates and checks ownership of these; sending them
      // as submitted keeps the checkbox list the only source of the selection.
      compatibleTreatmentIds: getIdList(formData, "compatibleTreatmentIds"),
    },
  };
}

// The add-on save functions raise Ceaute error codes described in
// supabase/migrations/202609140002_make_add_on_compatibility_atomic.sql.
function describeAddOnSaveError(error, fallbackMessage) {
  if (error.code === "23505") {
    return "You already have an add-on with that name.";
  }

  if (error.code === "CE003") {
    return "Choose only your active treatments for compatibility.";
  }

  if (error.code === "CE002") {
    return "Could not find that add-on.";
  }

  return fallbackMessage;
}

function toAddOnSummary(addOn) {
  return {
    addOnId: addOn.id,
    name: addOn.name,
    additional_price: penceToPrice(addOn.additional_price_pence),
    additional_price_pence: addOn.additional_price_pence,
    additional_duration_minutes: addOn.additional_duration_minutes,
    is_active: Boolean(addOn.is_active),
    updated_at: addOn.updated_at,
  };
}

// The add-on form offers compatibility with the provider's active treatments.
export async function getAddOnFormOptions({ next = "/dashboard/add-ons" } = {}) {
  const { supabase, providerPage } = await getSignedInProvider({ next });
  const { data: treatments, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select("id, name, is_active")
    .eq("provider_page_id", providerPage.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Could not load treatments.");
  }

  return { treatments: treatments ?? [] };
}

export async function getAllAddOns() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/add-ons",
  });

  const [addOnsResult, compatibilityResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment_add_on")
      .select(addOnSelect)
      .eq("provider_page_id", providerPage.id)
      .order("is_active", { ascending: false })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment_add_on_compatibility")
      .select("treatment_add_on_id")
      .eq("provider_page_id", providerPage.id),
  ]);

  if (addOnsResult.error) {
    throw new Error("Could not load add-ons.");
  }

  if (compatibilityResult.error) {
    throw new Error("Could not load add-on compatibility.");
  }

  const treatmentCounts = new Map();

  for (const compatibility of compatibilityResult.data ?? []) {
    treatmentCounts.set(
      compatibility.treatment_add_on_id,
      (treatmentCounts.get(compatibility.treatment_add_on_id) ?? 0) + 1,
    );
  }

  return (addOnsResult.data ?? []).map((addOn) => ({
    ...toAddOnSummary(addOn),
    compatible_treatment_count: treatmentCounts.get(addOn.id) ?? 0,
  }));
}

export async function getAddOn(addOnId) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/add-ons",
  });

  const [addOnResult, compatibilityResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment_add_on")
      .select(addOnSelect)
      .eq("id", addOnId)
      .eq("provider_page_id", providerPage.id)
      .maybeSingle(),
    supabase
      .schema("ceaute")
      .from("treatment_add_on_compatibility")
      .select("treatment_id")
      .eq("treatment_add_on_id", addOnId)
      .eq("provider_page_id", providerPage.id),
  ]);

  if (addOnResult.error || !addOnResult.data) {
    redirect("/dashboard/add-ons");
  }

  if (compatibilityResult.error) {
    throw new Error("Could not load add-on compatibility.");
  }

  return {
    ...toAddOnSummary(addOnResult.data),
    compatibleTreatmentIds: (compatibilityResult.data ?? []).map(
      (compatibility) => compatibility.treatment_id,
    ),
  };
}

export async function createAddOnWithCompatibility(_currentState, formData) {
  const { supabase } = await getSignedInProvider({
    next: "/dashboard/add-ons/new",
  });
  const result = parseAddOnForm(formData);

  if (result.error) {
    return result.error;
  }

  const { error } = await supabase
    .schema("ceaute")
    .rpc("create_add_on_with_compatibility", {
      add_on_name: result.values.name,
      additional_price_pence: result.values.additionalPricePence,
      additional_duration_minutes: result.values.additionalDurationMinutes,
      compatible_treatment_ids: result.values.compatibleTreatmentIds,
    });

  if (error) {
    return describeAddOnSaveError(error, "Could not create the add-on.");
  }

  refreshAddOnPages();
  redirect("/dashboard/add-ons");
}

export async function updateAddOnWithCompatibility(_currentState, formData) {
  const addOnId = getString(formData, "addOnId");
  const { supabase } = await getSignedInProvider({
    next: `/dashboard/add-ons/${addOnId}/edit`,
  });
  const result = parseAddOnForm(formData);

  if (result.error) {
    return result.error;
  }

  const { error } = await supabase
    .schema("ceaute")
    .rpc("update_add_on_with_compatibility", {
      target_add_on_id: addOnId,
      add_on_name: result.values.name,
      additional_price_pence: result.values.additionalPricePence,
      additional_duration_minutes: result.values.additionalDurationMinutes,
      compatible_treatment_ids: result.values.compatibleTreatmentIds,
    });

  if (error) {
    return describeAddOnSaveError(error, "Could not update the add-on.");
  }

  refreshAddOnPages();
  redirect("/dashboard/add-ons");
}

// Archiving and restoring leave compatibility alone: an archived add-on keeps
// its treatments so restoring it returns the provider to where they were.
export async function archiveAddOn(_currentState, formData) {
  const addOnId = getString(formData, "addOnId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/add-ons/${addOnId}/edit`,
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment_add_on")
    .update({ is_active: false })
    .eq("id", addOnId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not archive the add-on.";
  }

  refreshAddOnPages();
  redirect("/dashboard/add-ons");
}

export async function restoreAddOn(_currentState, formData) {
  const addOnId = getString(formData, "addOnId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/add-ons/${addOnId}/edit`,
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment_add_on")
    .update({ is_active: true })
    .eq("id", addOnId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not restore the add-on.";
  }

  refreshAddOnPages();
  redirect("/dashboard/add-ons");
}
