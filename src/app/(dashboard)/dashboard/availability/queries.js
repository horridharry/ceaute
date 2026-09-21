// Read-only loaders for /dashboard/availability. Availability mutations live
// in ./actions.js.

import { getSignedInProvider } from "../_lib/provider-data";
import { todayInLondon } from "./_lib/today-london";
import { weekdayNumberToName } from "./_lib/weekdays";

export const getSchedule = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });

  const { data: schedule, error } = await supabase
    .schema("ceaute")
    .from("availability_rule")
    .select("weekday, starts_at, ends_at")
    .eq("provider_page_id", providerPage.id)
    .order("weekday", { ascending: true });

  if (error) {
    throw new Error("Could not load availability.");
  }

  return schedule
    .map((entry) => ({
      day_of_week: weekdayNumberToName(entry.weekday),
      start_time: entry.starts_at,
      end_time: entry.ends_at,
    }))
    .filter((entry) => entry.day_of_week);
};

export const getBlockedDates = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });

  const { data: blockedDates, error } = await supabase
    .schema("ceaute")
    .from("blocked_date")
    .select("id, local_date")
    .eq("provider_page_id", providerPage.id)
    .gte("local_date", todayInLondon())
    .order("local_date", { ascending: true });

  if (error) {
    throw new Error("Could not load blocked dates.");
  }

  return blockedDates ?? [];
};

// Upcoming confirmed bookings and in-progress payments (unexpired holds) per
// Europe/London date. A security definer function counts them because
// providers cannot read holds through row-level security. Returns the raw rows,
// each { local_date, confirmed_count, in_progress_count }; map them with
// toBookingCountsByDate from ./_lib/booking-messages.
export const getBookingCountsByDate = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });

  const { data, error } = await supabase
    .schema("ceaute")
    .rpc("get_provider_booking_counts_by_local_date", {
      target_provider_page_id: providerPage.id,
    });

  if (error) {
    throw new Error("Could not load bookings for availability.");
  }

  return data ?? [];
};
