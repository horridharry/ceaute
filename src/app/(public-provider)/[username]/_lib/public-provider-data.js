import { cache } from "react";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calculateAvailableAppointmentTimes } from "../book/_lib/appointment-availability";
import { normalizePublicUsername } from "@/features/storefront/format";
import { logSupabaseError } from "@/lib/supabase/log-error";
import { findPublishedHeroImage } from "@/features/storefront/hero-image";

export const getPublishedProviderPageByUsername = cache(async (username) => {
  const normalizedUsername = normalizePublicUsername(username);

  if (!normalizedUsername) {
    notFound();
  }

  const supabase = createServiceRoleClient();
  const { data: providerPage, error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .select(
      "id, username, display_name, provider_category, biography, status, display_photo_path",
    )
    .eq("username", normalizedUsername)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    logSupabaseError("published provider page lookup", error);
    throw new Error("Could not load provider page.", { cause: error });
  }

  if (!providerPage) {
    notFound();
  }

  return providerPage;
});

// The hero image used for link previews (see findPublishedHeroImage). Unlike
// the lookup above, this never calls notFound().
export const getPublishedHeroImage = cache(async (username) =>
  findPublishedHeroImage(
    createServiceRoleClient(),
    normalizePublicUsername(username),
  ),
);

export const getPublicTreatmentForProvider = cache(
  async (providerPageId, treatmentId) => {
    const supabase = createServiceRoleClient();
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
  const supabase = createServiceRoleClient();
  const { data: availabilityRules, error } = await supabase.schema("ceaute").rpc(
    "get_public_availability_rules",
    {
      target_provider_page_id: providerPageId,
    },
  );

  if (error) {
    throw new Error("Could not load availability.");
  }

  return availabilityRules ?? [];
});

export const getActiveAddOnsForTreatment = cache(
  async (providerPageId, treatmentId, selectedAddOnIds = []) => {
    const requestedAddOnIds = [...new Set(selectedAddOnIds.filter(Boolean))];

    if (requestedAddOnIds.length === 0) {
      return [];
    }

    const supabase = createServiceRoleClient();
    const { data: addOns, error } = await supabase
      .schema("ceaute")
      .from("treatment_add_on")
      .select(
        "id, name, additional_price_pence, additional_duration_minutes, treatment_add_on_compatibility!inner(treatment_id)",
      )
      .eq("provider_page_id", providerPageId)
      .eq("is_active", true)
      .in("id", requestedAddOnIds)
      .eq("treatment_add_on_compatibility.treatment_id", treatmentId)
      .eq("treatment_add_on_compatibility.provider_page_id", providerPageId);

    if (error) {
      throw new Error("Could not load add-ons.");
    }

    if ((addOns ?? []).length !== requestedAddOnIds.length) {
      notFound();
    }

    return addOns ?? [];
  },
);

export const getCompatibleAddOnsForTreatment = cache(
  async (providerPageId, treatmentId) => {
    const supabase = createServiceRoleClient();
    const { data: addOns, error } = await supabase
      .schema("ceaute")
      .from("treatment_add_on")
      .select(
        "id, name, additional_price_pence, additional_duration_minutes, treatment_add_on_compatibility!inner(treatment_id)",
      )
      .eq("provider_page_id", providerPageId)
      .eq("is_active", true)
      .eq("treatment_add_on_compatibility.treatment_id", treatmentId)
      .eq("treatment_add_on_compatibility.provider_page_id", providerPageId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error("Could not load compatible add-ons.");
    }

    return addOns ?? [];
  },
);

export const getBlockedDatesForProvider = cache(async (providerPageId) => {
  const supabase = createServiceRoleClient();
  const { data: blockedDates, error } = await supabase.schema("ceaute").rpc(
    "get_public_blocked_dates",
    {
      target_provider_page_id: providerPageId,
    },
  );

  if (error) {
    throw new Error("Could not load blocked dates.");
  }

  return (blockedDates ?? []).map((blockedDate) => blockedDate.local_date);
});

export const getOccupiedPeriodsForProvider = cache(async (providerPageId) => {
  const supabase = createServiceRoleClient();
  const { data: occupiedPeriods, error } = await supabase.schema("ceaute").rpc(
    "get_public_occupied_periods",
    {
      target_provider_page_id: providerPageId,
    },
  );

  if (error) {
    throw new Error("Could not load occupied periods.");
  }

  return occupiedPeriods ?? [];
});

export const getPublicLocationForProvider = cache(async (providerPageId) => {
  const supabase = createServiceRoleClient();
  const { data: location, error } = await supabase.schema("ceaute").rpc(
    "get_public_provider_location",
    {
      target_provider_page_id: providerPageId,
    },
  );

  if (error) {
    throw new Error("Could not load provider location.");
  }

  // The RPC returns the current location's public area and nothing else, so
  // the single row here is the provider's answer to "where do you work?", not
  // an arbitrary pick from the locations they have saved.
  return location?.[0] ?? { public_area: "" };
});

export const getPublicBookingSettingsForProvider = cache(
  async (providerPageId) => {
    const supabase = createServiceRoleClient();
    const { data: settings, error } = await supabase.schema("ceaute").rpc(
      "get_public_booking_settings",
      {
        target_provider_page_id: providerPageId,
      },
    );

    if (error) {
      throw new Error("Could not load booking settings.");
    }

    return (
      settings?.[0] ?? {
        payment_mode: "full",
        commitment_amount_pence: null,
        cancellation_window_hours: 24,
        written_policy: "",
      }
    );
  },
);

export async function getPublicBookingPage(username, treatmentId, addOnIds = []) {
  const providerPage = await getPublishedProviderPageByUsername(username);
  const [
    treatment,
    availabilityRules,
    compatibleAddOns,
    selectedAddOns,
    blockedDates,
    occupiedPeriods,
  ] = await Promise.all([
    getPublicTreatmentForProvider(providerPage.id, treatmentId),
    getAvailabilityRulesForProvider(providerPage.id),
    getCompatibleAddOnsForTreatment(providerPage.id, treatmentId),
    getActiveAddOnsForTreatment(providerPage.id, treatmentId, addOnIds),
    getBlockedDatesForProvider(providerPage.id),
    getOccupiedPeriodsForProvider(providerPage.id),
  ]);
  const totalDurationMinutes =
    treatment.duration_minutes +
    selectedAddOns.reduce(
      (total, addOn) => total + Number(addOn.additional_duration_minutes ?? 0),
      0,
    );

  return {
    providerPage,
    treatment,
    compatibleAddOns,
    selectedAddOns,
    totalDurationMinutes,
    availabilityRules,
    availableDates: calculateAvailableAppointmentTimes({
      availabilityRules,
      blockedDates,
      appointments: occupiedPeriods,
      durationMinutes: totalDurationMinutes,
    }),
  };
}

export async function getPublicBookingDetailsPage(
  username,
  treatmentId,
  addOnIds = [],
) {
  const providerPage = await getPublishedProviderPageByUsername(username);
  const [
    treatment,
    availabilityRules,
    selectedAddOns,
    blockedDates,
    occupiedPeriods,
    location,
    bookingSettings,
  ] = await Promise.all([
    getPublicTreatmentForProvider(providerPage.id, treatmentId),
    getAvailabilityRulesForProvider(providerPage.id),
    getActiveAddOnsForTreatment(providerPage.id, treatmentId, addOnIds),
    getBlockedDatesForProvider(providerPage.id),
    getOccupiedPeriodsForProvider(providerPage.id),
    getPublicLocationForProvider(providerPage.id),
    getPublicBookingSettingsForProvider(providerPage.id),
  ]);
  const totalDurationMinutes =
    treatment.duration_minutes +
    selectedAddOns.reduce(
      (total, addOn) => total + Number(addOn.additional_duration_minutes ?? 0),
      0,
    );
  const totalPricePence =
    treatment.price_pence +
    selectedAddOns.reduce(
      (total, addOn) => total + Number(addOn.additional_price_pence ?? 0),
      0,
    );
  const availableDates = calculateAvailableAppointmentTimes({
    availabilityRules,
    blockedDates,
    appointments: occupiedPeriods,
    durationMinutes: totalDurationMinutes,
  });

  return {
    providerPage,
    treatment,
    selectedAddOns,
    totalDurationMinutes,
    totalPricePence,
    location,
    bookingSettings,
    availableDates,
  };
}

