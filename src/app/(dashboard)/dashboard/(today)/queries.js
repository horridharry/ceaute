import { getSignedInProvider } from "../_lib/provider-data";
import { loadProviderBookingGroups } from "@/lib/bookings/provider-booking-groups";

export async function getTodayBookingGroups() {
  const { supabase } = await getSignedInProvider({ next: "/dashboard" });
  return loadProviderBookingGroups(supabase);
}
