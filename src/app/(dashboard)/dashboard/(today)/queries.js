import { getSignedInProvider } from "../_lib/provider-data";
import { getProviderPagePublicationReadiness } from "../_lib/publication-readiness";
import { loadProviderBookingGroups } from "@/lib/bookings/provider-booking-groups";

// Today's working overview: the provider's appointments (holds already left
// out on the server) and, while the page is still a draft, what is left
// before it can be published.
export async function getTodayOverview() {
  const { supabase, providerPage } = await getSignedInProvider({ next: "/dashboard" });
  const [groups, readiness] = await Promise.all([
    loadProviderBookingGroups(supabase),
    providerPage.status === "draft"
      ? getProviderPagePublicationReadiness({ supabase, providerPage })
      : Promise.resolve(null),
  ]);

  return { groups, readiness };
}
