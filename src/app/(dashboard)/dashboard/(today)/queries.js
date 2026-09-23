import { getSignedInProvider } from "../_lib/provider-data";
import { getSetupState } from "../_lib/publication-checks";
import { loadProviderBookingGroups } from "@/lib/bookings/provider-booking-groups";

// Today's working overview: the provider's appointments (holds already left
// out on the server) and the page's setup state, for the Ready to publish
// card and the notice a live page shows when it cannot take bookings.
export async function getTodayOverview() {
  const { supabase, providerPage } = await getSignedInProvider({ next: "/dashboard" });
  const [groups, setup] = await Promise.all([
    loadProviderBookingGroups(supabase),
    getSetupState({ supabase, providerPage }),
  ]);

  return { groups, setup };
}
