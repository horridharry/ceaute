import { logSupabaseError } from "@/lib/supabase/log-error";
import { buildTreatmentSections } from "./treatment-sections";

// The public treatment queries: active rows only, in the order customers see
// them. Groups sort by display_order then name; treatments within a group by
// display_order then most recently updated first; add-ons by display_order
// then name. Providers cannot yet change display_order (every row keeps the
// default 0), so in practice groups are alphabetical and the most recently
// edited treatment comes first. Each list ends with its id so rows that tie
// on everything else still come back in the same order on every request.
// The storefront preview and the All treatments page both read through here.
export function treatmentQueries(supabase, providerPageId) {
  const db = supabase.schema("ceaute");

  return {
    groups: db
      .from("treatment_group")
      .select("id, name, display_order")
      .eq("provider_page_id", providerPageId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true }),
    treatments: db
      .from("treatment")
      .select(
        "id, name, description, duration_minutes, price_pence, display_order, treatment_group_id, updated_at",
      )
      .eq("provider_page_id", providerPageId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
    addOns: db
      .from("treatment_add_on")
      .select(
        "id, name, additional_price_pence, additional_duration_minutes, display_order",
      )
      .eq("provider_page_id", providerPageId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true }),
    compatibility: db
      .from("treatment_add_on_compatibility")
      .select("treatment_id, treatment_add_on_id")
      .eq("provider_page_id", providerPageId),
  };
}

// Loads the grouped treatments for a published page (the All treatments
// page); the storefront view model runs the same queries alongside its own.
export async function loadTreatmentSections(supabase, providerPageId) {
  const queries = treatmentQueries(supabase, providerPageId);
  const [groups, treatments, addOns, compatibility] = await Promise.all([
    queries.groups,
    queries.treatments,
    queries.addOns,
    queries.compatibility,
  ]);
  const results = { groups, treatments, addOns, compatibility };
  const failure = Object.entries(results).find(([, result]) => result.error);

  if (failure) {
    logSupabaseError(`treatments: ${failure[0]}`, failure[1].error);
    throw new Error("Could not load treatments.", { cause: failure[1].error });
  }

  return buildTreatmentSections({
    groups: groups.data ?? [],
    treatments: treatments.data ?? [],
    addOns: addOns.data ?? [],
    compatibility: compatibility.data ?? [],
  });
}
