"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  durationToMinutes,
  getSignedInProvider,
  priceToPence,
  treatmentToProviderTreatment,
} from "../_lib/provider-data";

const treatmentSelect = `
  id,
  provider_page_id,
  name,
  description,
  price_pence,
  duration_minutes,
  discovery_category_id,
  treatment_group_id,
  is_active,
  updated_at
`;

function getString(formData, key) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalId(formData, key) {
  const value = getString(formData, key);
  return value || null;
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

async function getTreatmentFormOptionsForProvider({ supabase, providerPage }) {
  const [discoveryCategoriesResult, treatmentGroupsResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("discovery_category")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment_group")
      .select("id, name")
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (discoveryCategoriesResult.error) {
    throw new Error("Could not load discovery categories.");
  }

  if (treatmentGroupsResult.error) {
    throw new Error("Could not load treatment groups.");
  }

  return {
    discoveryCategories: discoveryCategoriesResult.data ?? [],
    treatmentGroups: treatmentGroupsResult.data ?? [],
  };
}

function decorateTreatment(treatment, { discoveryCategories, treatmentGroups }) {
  const discoveryCategory = discoveryCategories.find(
    (category) => category.id === treatment.discovery_category_id,
  );
  const treatmentGroup = treatmentGroups.find(
    (group) => group.id === treatment.treatment_group_id,
  );

  return treatmentToProviderTreatment({
    ...treatment,
    discovery_category: discoveryCategory ?? null,
    treatment_group: treatmentGroup ?? null,
  });
}

function refreshTreatmentPages() {
  revalidatePath("/provider/treatments");
  revalidatePath("/[username]", "layout");
}

export async function getTreatmentFormOptions({
  next = "/provider/treatments",
} = {}) {
  const { supabase, providerPage } = await getSignedInProvider({ next });

  return getTreatmentFormOptionsForProvider({ supabase, providerPage });
}

export async function createTreatment(_currentState, formData) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/treatments/create",
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
  redirect("/provider/treatments");
}

export async function getTreatment(treatmentId) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/treatments",
  });

  const { data: treatment, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select(treatmentSelect)
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error || !treatment) {
    redirect("/provider/treatments");
  }

  const options = await getTreatmentFormOptionsForProvider({
    supabase,
    providerPage,
  });

  return decorateTreatment(treatment, options);
}

export async function updateTreatment(_currentState, formData) {
  const treatmentId = getString(formData, "treatment_id");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/provider/treatments/update/${treatmentId}`,
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
  redirect("/provider/treatments");
}

export async function archiveTreatment(_currentState, formData) {
  const treatmentId = getString(formData, "treatment_id");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/provider/treatments/update/${treatmentId}`,
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
  redirect("/provider/treatments");
}

export async function restoreTreatment(_currentState, formData) {
  const treatmentId = getString(formData, "treatment_id");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/provider/treatments/update/${treatmentId}`,
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
  redirect("/provider/treatments");
}

export async function getAllTreatments() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/treatments",
  });

  const { data: treatments, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select(treatmentSelect)
    .eq("provider_page_id", providerPage.id)
    .order("is_active", { ascending: false })
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Could not load treatments.");
  }

  const options = await getTreatmentFormOptionsForProvider({
    supabase,
    providerPage,
  });

  return treatments.map((treatment) => decorateTreatment(treatment, options));
}
