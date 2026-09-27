// Read-only loaders for /dashboard/availability. Availability mutations live
// in ./actions.js.

import { getSignedInProvider } from "../_lib/provider-data";
import { namedDrops, sortDates, toClockValue } from "./_lib/drop-form";
import { todayInLondon } from "./_lib/today-london";

// The provider's current drops, read through their own row-level security:
// each { id, opensAt, dates, name, firstDate, lastDate }, where a date is
// { local_date, hours_start, hours_end, start_times } with times as 'HH:MM'.
// Past dates are left out, so a drop whose dates have all passed is too.
// Drops are ordered by their first date.
export const getDrops = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });

  const [dropsResult, datesResult] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("availability_drop")
      .select("id, opens_at")
      .eq("provider_page_id", providerPage.id),
    supabase
      .schema("ceaute")
      .from("availability_date")
      .select("drop_id, local_date, hours_start, hours_end, start_times")
      .eq("provider_page_id", providerPage.id)
      .gte("local_date", todayInLondon())
      .order("local_date", { ascending: true }),
  ]);

  if (dropsResult.error || datesResult.error) {
    throw new Error("Could not load availability.");
  }

  const datesByDrop = new Map();

  for (const row of datesResult.data ?? []) {
    const date = {
      local_date: String(row.local_date).slice(0, 10),
      hours_start: row.hours_start ? toClockValue(row.hours_start) : null,
      hours_end: row.hours_end ? toClockValue(row.hours_end) : null,
      start_times: Array.isArray(row.start_times)
        ? row.start_times.map(toClockValue)
        : null,
    };
    const list = datesByDrop.get(row.drop_id) ?? [];
    list.push(date);
    datesByDrop.set(row.drop_id, list);
  }

  const drops = (dropsResult.data ?? [])
    .filter((drop) => datesByDrop.has(drop.id))
    .map((drop) => ({
      id: drop.id,
      opensAt: drop.opens_at,
      dates: sortDates(datesByDrop.get(drop.id)),
    }))
    .sort((a, b) =>
      a.dates[0].local_date.localeCompare(b.dates[0].local_date),
    );

  return namedDrops(drops);
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
