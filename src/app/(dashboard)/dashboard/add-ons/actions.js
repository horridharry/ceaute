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
  nonNegativePriceToPence,
} from "../_lib/price-duration";
import { addOnTransitionOutcome, isTransition } from "../_lib/lifecycle-outcome";
import { getSignedInProvider } from "../_lib/provider-data";

// An add-on is shown on its own page, against every treatment that accepts it
// and on the provider's public pages, so a change makes all of them stale.
function refreshAddOnPages() {
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/add-ons");
  revalidatePath("/[username]", "layout");
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

// Archive, restore and delete go through ceaute.transition_treatment_add_on
// (202609220002), the only writer of is_active and deleted_at. PostgreSQL
// checks ownership and refuses invalid transitions (deleting an active
// add-on, touching a deleted one); a repeated request is harmless. Archiving
// and deleting leave the add-on's treatment links in place.
async function runAddOnTransition(formData) {
  const addOnId = getString(formData, "addOnId");
  const transition = getString(formData, "transition");
  const name = getString(formData, "addOnName") || "The add-on";
  const { supabase } = await getSignedInProvider({ next: "/dashboard/add-ons" });

  if (!addOnId || !isTransition(transition)) {
    return { status: "error", message: "Choose an add-on to change.", id: addOnId };
  }

  const { error } = await supabase
    .schema("ceaute")
    .rpc("transition_treatment_add_on", {
      target_add_on_id: addOnId,
      requested_transition: transition,
    });

  if (!error) {
    refreshAddOnPages();
  }

  return { ...addOnTransitionOutcome({ transition, name, error }), id: addOnId, transition };
}

export async function transitionAddOn(_currentState, formData) {
  return runAddOnTransition(formData);
}
