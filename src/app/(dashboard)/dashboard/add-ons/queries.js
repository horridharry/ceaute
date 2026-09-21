// Read-only loaders for /dashboard/add-ons. Add-on mutations live in
// ./actions.js.

import { redirect } from "next/navigation";
import { penceToPrice } from "../_lib/price-duration";
import { getSignedInProvider } from "../_lib/provider-data";

const addOnSelect =
  "id, name, additional_price_pence, additional_duration_minutes, is_active, updated_at";

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
