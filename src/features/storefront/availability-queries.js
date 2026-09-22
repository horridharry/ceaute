import { logSupabaseError } from "@/lib/supabase/log-error";
import { openingHours } from "./opening-hours";

// The provider's weekly opening hours for their page. One row exists per day
// they are open, so closed days are simply absent; blocked dates live in
// another table and are deliberately not read here. The storefront's
// published check (the (storefront) route group) decides who may see this,
// exactly as it does for treatments and photos.
export function openingHoursQuery(supabase, providerPageId) {
  return supabase
    .schema("ceaute")
    .from("availability_rule")
    .select("weekday, starts_at, ends_at")
    .eq("provider_page_id", providerPageId)
    .order("weekday", { ascending: true });
}

export async function loadOpeningHours(supabase, providerPageId) {
  const { data, error } = await openingHoursQuery(supabase, providerPageId);

  if (error) {
    logSupabaseError("opening hours", error);
    throw new Error("Could not load opening hours.", { cause: error });
  }

  return openingHours(data);
}
