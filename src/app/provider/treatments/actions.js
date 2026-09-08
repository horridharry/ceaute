"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  durationToMinutes,
  getSignedInProvider,
  priceToPence,
  treatmentToDashboardTreatment,
} from "../lib/provider-data";

export const createTreatment = async (_currentState, formData) => {
  const pricePence = priceToPence(formData.get("price"));
  const durationMinutes = durationToMinutes(formData.get("duration"));

  if (!String(formData.get("name") ?? "").trim()) {
    return "Please give your treatment a name";
  }

  if (!pricePence) {
    return "Please enter a valid price.";
  }

  if (durationMinutes < 5) {
    return "Duration must be at least 5 minutes";
  }

  const newTreatment = {
    name: String(formData.get("name") ?? "").trim(),
    price_pence: pricePence,
    duration_minutes: durationMinutes,
    description: String(formData.get("description") ?? "").trim() || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
  };

  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/treatments/create",
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .insert({ ...newTreatment, provider_page_id: providerPage.id });

  if (error) {
    return "Something went wrong.";
  }

  revalidatePath("/", "layout");
  redirect("/provider/treatments");
};

export const getTreatment = async (treatmentId) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/treatments",
  });

  const { data: treatment, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select("id, provider_page_id, name, description, price_pence, duration_minutes, image_url, updated_at")
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !treatment) {
    redirect("/provider/treatments");
  }

  return treatmentToDashboardTreatment(treatment);
};

export const updateTreatment = async (_currentState, formData) => {
  const treatmentId = formData.get("treatment_id");
  const pricePence = priceToPence(formData.get("price"));
  const durationMinutes = durationToMinutes(formData.get("duration"));

  if (!String(formData.get("name") ?? "").trim()) {
    return "Please give your treatment a name";
  }

  if (!pricePence) {
    return "Please enter a valid price.";
  }

  if (durationMinutes < 5) {
    return "Duration must be at least 5 minutes";
  }

  const newTreatment = {
    name: String(formData.get("name") ?? "").trim(),
    price_pence: pricePence,
    duration_minutes: durationMinutes,
    description: String(formData.get("description") ?? "").trim() || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
  };

  const { supabase, providerPage } = await getSignedInProvider({
    next: `/provider/treatments/update/${treatmentId}`,
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .update({ ...newTreatment })
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Something went wrong.";
  }

  revalidatePath("/", "layout");
  redirect("/provider/treatments");
};

export const deleteTreatment = async (treatmentId) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/treatments",
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .update({ is_active: false })
    .eq("id", treatmentId)
    .eq("provider_page_id", providerPage.id);

  if (error) {
    return "Something went wrong.";
  }

  revalidatePath("/", "layout");
  redirect("/provider/treatments");
};

export const getAllTreatments = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/treatments",
  });

  const { data: treatments, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select("id, provider_page_id, name, description, price_pence, duration_minutes, image_url, updated_at")
    .eq("provider_page_id", providerPage.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return treatments.map(treatmentToDashboardTreatment);
};
