"use server";

import { revalidatePath } from "next/cache";
import { getSignedInProvider } from "../_lib/provider-data";

const cleanText = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const normalizePostcode = (value) => {
  const postcode = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!postcode) {
    return null;
  }

  if (postcode.length <= 3) {
    return postcode;
  }

  return `${postcode.slice(0, -3)} ${postcode.slice(-3)}`;
};

export const getLocation = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/locations",
  });

  const { data: location, error } = await supabase
    .schema("ceaute")
    .from("provider_location")
    .select(
      "id, provider_page_id, public_area, address_line_1, address_line_2, city, postcode, access_instructions",
    )
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load provider location.");
  }

  return {
    public_area: location?.public_area ?? "",
    address_line_1: location?.address_line_1 ?? "",
    address_line_2: location?.address_line_2 ?? "",
    city: location?.city ?? "",
    postcode: location?.postcode ?? "",
    access_instructions: location?.access_instructions ?? "",
  };
};

export const updateLocation = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/locations",
  });

  const locationDetails = {
    provider_page_id: providerPage.id,
    public_area: cleanText(formData.get("public_area")),
    address_line_1: cleanText(formData.get("address_line_1")),
    address_line_2: cleanText(formData.get("address_line_2")),
    city: cleanText(formData.get("city")),
    postcode: normalizePostcode(formData.get("postcode")),
    access_instructions: cleanText(formData.get("access_instructions")),
    country_code: "GB",
    is_active: true,
  };

  if (locationDetails.public_area && locationDetails.public_area.length > 120) {
    return "Public area must be 120 characters or fewer.";
  }

  if (
    locationDetails.address_line_1 &&
    locationDetails.address_line_1.length > 160
  ) {
    return "Address line 1 must be 160 characters or fewer.";
  }

  if (
    locationDetails.address_line_2 &&
    locationDetails.address_line_2.length > 160
  ) {
    return "Address line 2 must be 160 characters or fewer.";
  }

  if (locationDetails.city && locationDetails.city.length > 100) {
    return "City must be 100 characters or fewer.";
  }

  if (locationDetails.postcode && locationDetails.postcode.length > 12) {
    return "Postcode must be 12 characters or fewer.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("provider_location")
    .upsert(locationDetails, {
      onConflict: "provider_page_id",
    });

  if (error) {
    if (error.code === "23505") {
      return "Only one active location can be saved for this page.";
    }

    if (error.code === "23514") {
      return "Check the location details and try again.";
    }

    return "Could not save your location.";
  }

  revalidatePath("/dashboard/locations");
  revalidatePath("/dashboard/page");
  return "Saved.";
};
