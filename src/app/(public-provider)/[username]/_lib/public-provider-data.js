import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateAvailableAppointmentTimes } from "../booking/_lib/appointment-availability";
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

    const supabase = await createClient();
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
    const supabase = await createClient();
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
  const supabase = await createClient();
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

export const getActiveBookingsForProvider = cache(async (providerPageId) => {
  const supabase = await createClient();
  const { data: bookings, error } = await supabase.schema("ceaute").rpc(
    "get_public_occupied_periods",
    {
      target_provider_page_id: providerPageId,
    },
  );

  if (error) {
    throw new Error("Could not load existing bookings.");
  }

  return bookings ?? [];
});

export const getPublicLocationForProvider = cache(async (providerPageId) => {
  const supabase = await createClient();
  const { data: location, error } = await supabase.schema("ceaute").rpc(
    "get_public_provider_location",
    {
      target_provider_page_id: providerPageId,
    },
  );

  if (error) {
    throw new Error("Could not load provider location.");
  }

  return location?.[0] ?? { public_area: "" };
});

export const getPublicBookingSettingsForProvider = cache(
  async (providerPageId) => {
    const supabase = await createClient();
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

export async function getPublicBookingPage(username, treatmentId, addOnIds = []) {
  const providerPage = await getPublishedProviderPageByUsername(username);
  const [
    treatment,
    availabilityRules,
    compatibleAddOns,
    selectedAddOns,
    blockedDates,
    bookings,
  ] = await Promise.all([
    getPublicTreatmentForProvider(providerPage.id, treatmentId),
    getAvailabilityRulesForProvider(providerPage.id),
    getCompatibleAddOnsForTreatment(providerPage.id, treatmentId),
    getActiveAddOnsForTreatment(providerPage.id, treatmentId, addOnIds),
    getBlockedDatesForProvider(providerPage.id),
    getActiveBookingsForProvider(providerPage.id),
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
      appointments: bookings,
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
    bookings,
    location,
    bookingSettings,
  ] = await Promise.all([
    getPublicTreatmentForProvider(providerPage.id, treatmentId),
    getAvailabilityRulesForProvider(providerPage.id),
    getActiveAddOnsForTreatment(providerPage.id, treatmentId, addOnIds),
    getBlockedDatesForProvider(providerPage.id),
    getActiveBookingsForProvider(providerPage.id),
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
    appointments: bookings,
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

