// Saved locations for /dashboard/locations. A provider keeps a list of places
// they work from and marks exactly one as current. Customers never choose
// between them: the current location is what the page advertises, what
// discovery matches, and what a new booking is held against.
//
// Which one is current is not a column this file writes. PostgreSQL owns that
// transition in ceaute.set_primary_provider_location, because moving also has
// to retire the in-progress holds the move invalidates, and the two must
// happen together or not at all.

import { getSignedInProvider } from "../_lib/provider-data";

// The list screen never renders an access instruction, and everything a server
// component hands a client component travels to the browser in the page source.
// The edit form is the one screen that needs them, and it asks for one row.
const LOCATION_LIST_COLUMNS =
  "id, public_area, address_line_1, address_line_2, city, postcode, is_primary";
const LOCATION_DETAIL_COLUMNS = `${LOCATION_LIST_COLUMNS}, access_instructions`;

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
