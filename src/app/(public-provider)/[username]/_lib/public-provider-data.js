import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePublicUsername } from "./public-provider-format";

export const getPublishedProviderPageByUsername = cache(async (username) => {
  const normalizedUsername = normalizePublicUsername(username);

  if (!normalizedUsername) {
    notFound();
  }

  const supabase = await createClient();
  const { data: providerPage, error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .select("id, owner_profile_id, username, display_name, biography, status")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load provider page.");
  }

  if (!providerPage || providerPage.status === "suspended") {
    notFound();
  }

  return providerPage;
});

export const getPublicTreatmentsForProvider = cache(async (providerPageId) => {
  const supabase = await createClient();
  const { data: treatments, error } = await supabase
    .schema("ceaute")
    .from("treatment")
    .select(
      "id, provider_page_id, name, description, duration_minutes, price_pence, image_url, is_active, display_order, updated_at",
    )
    .eq("provider_page_id", providerPageId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Could not load treatments.");
  }

  return treatments ?? [];
});

export const getPublicTreatmentForProvider = cache(
  async (providerPageId, treatmentId) => {
    const supabase = await createClient();
    const { data: treatment, error } = await supabase
      .schema("ceaute")
      .from("treatment")
      .select(
        "id, provider_page_id, name, description, duration_minutes, price_pence, image_url, is_active, display_order, updated_at",
      )
      .eq("provider_page_id", providerPageId)
      .eq("id", treatmentId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw new Error("Could not load treatment.");
    }

    if (!treatment) {
      notFound();
    }

    return treatment;
  },
);

export const getAvailabilityRulesForProvider = cache(async (providerPageId) => {
  const supabase = await createClient();
  const { data: availabilityRules, error } = await supabase
    .schema("ceaute")
    .from("availability_rule")
    .select("weekday, starts_at, ends_at")
    .eq("provider_page_id", providerPageId)
    .order("weekday", { ascending: true });

  if (error) {
    throw new Error("Could not load availability.");
  }

  return availabilityRules ?? [];
});

export async function getPublicProviderCatalogue(username) {
  const providerPage = await getPublishedProviderPageByUsername(username);
  const treatments = await getPublicTreatmentsForProvider(providerPage.id);

  return {
    providerPage,
    treatments,
  };
}

export async function getPublicTreatmentPage(username, treatmentId) {
  const providerPage = await getPublishedProviderPageByUsername(username);
  const treatment = await getPublicTreatmentForProvider(
    providerPage.id,
    treatmentId,
  );

  return {
    providerPage,
    treatment,
  };
}

export async function getPublicBookingPage(username, treatmentId) {
  const providerPage = await getPublishedProviderPageByUsername(username);
  const [treatment, availabilityRules] = await Promise.all([
    getPublicTreatmentForProvider(providerPage.id, treatmentId),
    getAvailabilityRulesForProvider(providerPage.id),
  ]);

  return {
    providerPage,
    treatment,
    availabilityRules,
  };
}

