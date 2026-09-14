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

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function nonNegativePriceToPence(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return null;
  }

  const [pounds, pence = ""] = normalizedValue.split(".");
  const pricePence =
    Number(pounds) * 100 + Number(pence.padEnd(2, "0").slice(0, 2));

  if (!Number.isInteger(pricePence) || pricePence < 0) {
    return null;
  }

  return pricePence;
}

function penceToPrice(value) {
  const pence = Number(value);
  return Number.isFinite(pence) ? pence / 100 : 0;
}

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

function refreshTreatmentGroupPages() {
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/groups");
}

function refreshTreatmentAddOnPages() {
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/add-ons");
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
  revalidatePath("/dashboard/treatments");
  revalidatePath("/[username]", "layout");
}

export async function getTreatmentGroups({ next = "/dashboard/groups" } = {}) {
  const { supabase, providerPage } = await getSignedInProvider({
    next,
  });

  const [groupsResult, treatmentsResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment_group")
      .select("id, name, display_order, is_active, updated_at")
      .eq("provider_page_id", providerPage.id)
      .order("is_active", { ascending: false })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment")
      .select("treatment_group_id")
      .eq("provider_page_id", providerPage.id)
      .not("treatment_group_id", "is", null),
  ]);

  if (groupsResult.error) {
    throw new Error("Could not load treatment groups.");
  }

  if (treatmentsResult.error) {
    throw new Error("Could not check treatment group usage.");
  }

  const treatmentCounts = new Map();

  for (const treatment of treatmentsResult.data ?? []) {
    treatmentCounts.set(
      treatment.treatment_group_id,
      (treatmentCounts.get(treatment.treatment_group_id) ?? 0) + 1,
    );
  }

  return (groupsResult.data ?? []).map((group) => ({
    ...group,
    referenced_treatment_count: treatmentCounts.get(group.id) ?? 0,
  }));
}

export async function createTreatmentGroup(_currentState, formData) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/groups/new",
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
    next: `/dashboard/groups/${groupId}/edit`,
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

export async function archiveTreatmentGroup(_currentState, formData) {
  const groupId = getString(formData, "groupId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/groups",
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
    next: "/dashboard/groups",
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

async function findDuplicateTreatmentAddOn({
  supabase,
  providerPage,
  name,
  exceptAddOnId = "",
}) {
  const { data: addOns, error } = await supabase
    .schema("ceaute")
    .from("treatment_add_on")
    .select("id, name")
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return { error: "Could not check existing add-ons." };
  }

  const normalizedName = normalizeName(name);
  const duplicate = (addOns ?? []).find(
    (addOn) =>
      addOn.id !== exceptAddOnId && normalizeName(addOn.name) === normalizedName,
  );

  return { duplicate };
}

async function getActiveProviderTreatmentIds({ supabase, providerPage }) {
  const { data: treatments, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select("id")
    .eq("provider_page_id", providerPage.id)
    .eq("is_active", true);

  if (error) {
    return { error: "Could not check compatible treatments." };
  }

  return { treatmentIds: new Set((treatments ?? []).map((treatment) => treatment.id)) };
}

function getSelectedTreatmentIds(formData) {
  return formData
    .getAll("compatibleTreatmentIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

async function validateTreatmentAddOnForm({
  formData,
  supabase,
  providerPage,
  exceptAddOnId = "",
}) {
  const name = getString(formData, "name");
  const additionalPricePence = nonNegativePriceToPence(
    formData.get("additional_price"),
  );
  const additionalDurationMinutes = durationToMinutes(
    formData.get("additional_duration_minutes"),
  );
  const selectedTreatmentIds = getSelectedTreatmentIds(formData);

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

  const duplicateResult = await findDuplicateTreatmentAddOn({
    supabase,
    providerPage,
    name,
    exceptAddOnId,
  });

  if (duplicateResult.error) {
    return { error: duplicateResult.error };
  }

  if (duplicateResult.duplicate) {
    return { error: "You already have an add-on with that name." };
  }

  const treatmentIdsResult = await getActiveProviderTreatmentIds({
    supabase,
    providerPage,
  });

  if (treatmentIdsResult.error) {
    return { error: treatmentIdsResult.error };
  }

  const uniqueSelectedTreatmentIds = [...new Set(selectedTreatmentIds)];
  const hasInvalidTreatment = uniqueSelectedTreatmentIds.some(
    (treatmentId) => !treatmentIdsResult.treatmentIds.has(treatmentId),
  );

  if (hasInvalidTreatment) {
    return { error: "Choose only your active treatments for compatibility." };
  }

  return {
    values: {
      name,
      additional_price_pence: additionalPricePence,
      additional_duration_minutes: additionalDurationMinutes,
    },
    compatibleTreatmentIds: uniqueSelectedTreatmentIds,
  };
}

async function replaceAddOnCompatibility({
  supabase,
  providerPage,
  addOnId,
  compatibleTreatmentIds,
}) {
  const { error: deleteError } = await supabase
    .schema("ceaute")
    .from("treatment_add_on_compatibility")
    .delete()
    .eq("provider_page_id", providerPage.id)
    .eq("treatment_add_on_id", addOnId);

  if (deleteError) {
    return { error: "Could not update compatible treatments." };
  }

  if (compatibleTreatmentIds.length === 0) {
    return {};
  }

  const { error: insertError } = await supabase
    .schema("ceaute")
    .from("treatment_add_on_compatibility")
    .insert(
      compatibleTreatmentIds.map((treatmentId) => ({
        provider_page_id: providerPage.id,
        treatment_add_on_id: addOnId,
        treatment_id: treatmentId,
      })),
    );

  if (insertError) {
    return { error: "Could not save compatible treatments." };
  }

  return {};
}

export async function getTreatmentAddOnOptions({ next = "/dashboard/add-ons" } = {}) {
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

export async function getAllTreatmentAddOns() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/add-ons",
  });

  const [addOnsResult, compatibilityResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment_add_on")
      .select("id, name, additional_price_pence, additional_duration_minutes, is_active, updated_at")
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
    addOnId: addOn.id,
    name: addOn.name,
    additional_price: penceToPrice(addOn.additional_price_pence),
    additional_price_pence: addOn.additional_price_pence,
    additional_duration_minutes: addOn.additional_duration_minutes,
    is_active: Boolean(addOn.is_active),
    compatible_treatment_count: treatmentCounts.get(addOn.id) ?? 0,
    updated_at: addOn.updated_at,
  }));
}

export async function getTreatmentAddOn(addOnId) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/add-ons",
  });

  const [addOnResult, compatibilityResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("treatment_add_on")
      .select("id, name, additional_price_pence, additional_duration_minutes, is_active, updated_at")
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
    addOnId: addOnResult.data.id,
    name: addOnResult.data.name,
    additional_price: penceToPrice(addOnResult.data.additional_price_pence),
    additional_price_pence: addOnResult.data.additional_price_pence,
    additional_duration_minutes: addOnResult.data.additional_duration_minutes,
    is_active: Boolean(addOnResult.data.is_active),
    compatibleTreatmentIds: (compatibilityResult.data ?? []).map(
      (compatibility) => compatibility.treatment_id,
    ),
    updated_at: addOnResult.data.updated_at,
  };
}

export async function createTreatmentAddOn(_currentState, formData) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/add-ons/new",
  });
  const result = await validateTreatmentAddOnForm({
    formData,
    supabase,
    providerPage,
  });

  if (result.error) {
    return result.error;
  }

  const { data: addOn, error } = await supabase
    .schema("ceaute")
    .from("treatment_add_on")
    .insert({
      ...result.values,
      provider_page_id: providerPage.id,
    })
    .select("id")
    .single();

  if (error) {
    return "Could not create the add-on.";
  }

  const compatibilityResult = await replaceAddOnCompatibility({
    supabase,
    providerPage,
    addOnId: addOn.id,
    compatibleTreatmentIds: result.compatibleTreatmentIds,
  });

  if (compatibilityResult.error) {
    return compatibilityResult.error;
  }

  refreshTreatmentAddOnPages();
  redirect("/dashboard/add-ons");
}

export async function updateTreatmentAddOn(_currentState, formData) {
  const addOnId = getString(formData, "addOnId");
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/add-ons/${addOnId}/edit`,
  });
  const result = await validateTreatmentAddOnForm({
    formData,
    supabase,
    providerPage,
    exceptAddOnId: addOnId,
  });

  if (result.error) {
    return result.error;
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment_add_on")
    .update(result.values)
    .eq("id", addOnId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Could not update the add-on.";
  }

  const compatibilityResult = await replaceAddOnCompatibility({
    supabase,
    providerPage,
    addOnId,
    compatibleTreatmentIds: result.compatibleTreatmentIds,
  });

  if (compatibilityResult.error) {
    return compatibilityResult.error;
  }

  refreshTreatmentAddOnPages();
  redirect("/dashboard/add-ons");
}

export async function archiveTreatmentAddOn(_currentState, formData) {
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

  refreshTreatmentAddOnPages();
  redirect("/dashboard/add-ons");
}

export async function restoreTreatmentAddOn(_currentState, formData) {
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

  refreshTreatmentAddOnPages();
  redirect("/dashboard/add-ons");
}

export async function getTreatmentFormOptions({
  next = "/dashboard/treatments",
} = {}) {
  const { supabase, providerPage } = await getSignedInProvider({ next });

  return getTreatmentFormOptionsForProvider({ supabase, providerPage });
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

export async function getTreatment(treatmentId) {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatments",
  });

  const { data: treatment, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select(treatmentSelect)
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error || !treatment) {
    redirect("/dashboard/treatments");
  }

  const options = await getTreatmentFormOptionsForProvider({
    supabase,
    providerPage,
  });

  return decorateTreatment(treatment, options);
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

export async function getAllTreatments() {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/treatments",
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
