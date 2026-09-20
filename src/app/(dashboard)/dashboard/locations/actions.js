"use server";

// Saved locations for /dashboard/locations. A provider keeps a list of places
// they work from and marks exactly one as current. Customers never choose
// between them: the current location is what the page advertises, what
// discovery matches, and what a new booking is held against.
//
// Which one is current is not a column this file writes. PostgreSQL owns that
// transition in ceaute.set_primary_provider_location, because moving also has
// to retire the in-progress holds the move invalidates, and the two must
// happen together or not at all.

import { revalidatePath } from "next/cache";
import { getString } from "../_lib/form-values";
import { getSignedInProvider } from "../_lib/provider-data";

// The list screen never renders an access instruction, and everything a server
// component hands a client component travels to the browser in the page source.
// The edit form is the one screen that needs them, and it asks for one row.
const LOCATION_LIST_COLUMNS =
  "id, public_area, address_line_1, address_line_2, city, postcode, is_primary";
const LOCATION_DETAIL_COLUMNS = `${LOCATION_LIST_COLUMNS}, access_instructions`;

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

// The public area and the private address are both what the provider typed,
// so the same limits apply wherever a location is written.
function readLocationDetails(formData) {
  const details = {
    public_area: cleanText(formData.get("public_area")),
    address_line_1: cleanText(formData.get("address_line_1")),
    address_line_2: cleanText(formData.get("address_line_2")),
    city: cleanText(formData.get("city")),
    postcode: normalizePostcode(formData.get("postcode")),
    access_instructions: cleanText(formData.get("access_instructions")),
  };

  const tooLong = [
    ["public_area", 120, "Public area"],
    ["address_line_1", 160, "Address line 1"],
    ["address_line_2", 160, "Address line 2"],
    ["city", 100, "City"],
    ["postcode", 12, "Postcode"],
  ].find(([field, maxLength]) => details[field] && details[field].length > maxLength);

  if (tooLong) {
    return { error: `${tooLong[2]} must be ${tooLong[1]} characters or fewer.` };
  }

  return { details };
}

// A location change moves the public area, so the publication hints on the
// profile screen, the storefront and discovery are all stale afterwards. The
// layout-wide revalidation is the same blunt instrument the availability
// screen already uses for a provider-wide change; discovery results served
// from elsewhere can still lag, which product.md accepts.
function refreshLocationPages() {
  revalidatePath("/dashboard/locations");
  revalidatePath("/dashboard/profile");
  revalidatePath("/", "layout");
}

export const getLocations = async ({ next = "/dashboard/locations" } = {}) => {
  const { supabase, providerPage } = await getSignedInProvider({ next });

  const { data: locations, error } = await supabase
    .schema("ceaute")
    .from("provider_location")
    .select(LOCATION_LIST_COLUMNS)
    .eq("provider_page_id", providerPage.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Could not load your saved locations.");
  }

  return (locations ?? []).map((location) => ({
    id: location.id,
    public_area: location.public_area ?? "",
    address_line_1: location.address_line_1 ?? "",
    address_line_2: location.address_line_2 ?? "",
    city: location.city ?? "",
    postcode: location.postcode ?? "",
    is_primary: Boolean(location.is_primary),
  }));
};

export const getLocation = async (locationId) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/dashboard/locations/${locationId}/edit`,
  });

  const { data: location, error } = await supabase
    .schema("ceaute")
    .from("provider_location")
    .select(LOCATION_DETAIL_COLUMNS)
    .eq("id", locationId)
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load that location.");
  }

  if (!location) {
    return null;
  }

  return {
    id: location.id,
    public_area: location.public_area ?? "",
    address_line_1: location.address_line_1 ?? "",
    address_line_2: location.address_line_2 ?? "",
    city: location.city ?? "",
    postcode: location.postcode ?? "",
    access_instructions: location.access_instructions ?? "",
    is_primary: Boolean(location.is_primary),
  };
};

export const createLocation = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/locations/new",
  });
  const { details, error: validationError } = readLocationDetails(formData);

  if (validationError) {
    return validationError;
  }

  // is_primary and is_active are deliberately absent. Neither is writable from
  // here: PostgreSQL makes a provider's first saved location their current one,
  // and is_active defaults to true.
  const { error } = await supabase
    .schema("ceaute")
    .from("provider_location")
    .insert({
      ...details,
      provider_page_id: providerPage.id,
      country_code: "GB",
    });

  if (error) {
    if (error.code === "23514") {
      return "Check the location details and try again.";
    }

    return "Could not save your location.";
  }

  refreshLocationPages();
  return "Location saved.";
};

export const updateLocation = async (_currentState, formData) => {
  const locationId = getString(formData, "location_id");
  const { supabase, providerPage } = await getSignedInProvider({
    next: locationId
      ? `/dashboard/locations/${locationId}/edit`
      : "/dashboard/locations",
  });

  if (!locationId) {
    return "Choose a location to edit.";
  }

  const { details, error: validationError } = readLocationDetails(formData);

  if (validationError) {
    return validationError;
  }

  const { data: saved, error } = await supabase
    .schema("ceaute")
    .from("provider_location")
    .update(details)
    .eq("id", locationId)
    .eq("provider_page_id", providerPage.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23514") {
      return "Check the location details and try again.";
    }

    return "Could not save your location.";
  }

  if (!saved) {
    return "That location is no longer saved.";
  }

  refreshLocationPages();
  return "Saved.";
};

// The database decides whether this is allowed and what it means for bookings
// in progress; this action only reports the outcome.
export const makeLocationPrimary = async (_currentState, formData) => {
  const { supabase } = await getSignedInProvider({
    next: "/dashboard/locations",
  });
  const locationId = getString(formData, "location_id");

  if (!locationId) {
    return "Choose a location.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .rpc("set_primary_provider_location", {
      target_location_id: locationId,
    });

  if (error) {
    // 23514 is the check_violation the database raises when a published page
    // is asked to work from a location that has no usable address.
    if (error.code === "23514") {
      return "Add a public area and a full address to this location before working from it.";
    }

    return "Could not change where you are working from.";
  }

  refreshLocationPages();
  return "You are now working from this location.";
};

export const deleteLocation = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/locations",
  });
  const locationId = getString(formData, "location_id");

  if (!locationId) {
    return "Choose a location to delete.";
  }

  const { data: deleted, error } = await supabase
    .schema("ceaute")
    .from("provider_location")
    .delete()
    .eq("id", locationId)
    .eq("provider_page_id", providerPage.id)
    .select("id")
    .maybeSingle();

  if (error) {
    // 23001 is the restrict_violation the database raises when the location
    // being deleted is the one the provider is currently working from.
    if (error.code === "23001") {
      return "Make another saved location current before deleting this one.";
    }

    return "Could not delete that location.";
  }

  if (!deleted) {
    return "That location is no longer saved.";
  }

  refreshLocationPages();
  return "Location deleted.";
};
