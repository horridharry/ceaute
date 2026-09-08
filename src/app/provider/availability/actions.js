"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSignedInProvider,
  weekdayNameToNumber,
  weekdayNumberToName,
} from "../lib/provider-data";

export const getSchedule = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/availability",
  });

  const { data: schedule, error } = await supabase
    .schema("ceaute")
    .from("availability_rule")
    .select("weekday, starts_at, ends_at")
    .eq("provider_page_id", providerPage.id)
    .order("weekday", { ascending: true });

  if (error) {
    return [];
  }

  return schedule
    .map((entry) => ({
      day_of_week: weekdayNumberToName(entry.weekday),
      start_time: entry.starts_at,
      end_time: entry.ends_at,
    }))
    .filter((entry) => entry.day_of_week);
};

export const updateSchedule = async (schedule) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/availability",
  });

  const { error } = await supabase
    .schema("ceaute")
    .from("availability_rule")
    .delete()
    .eq("provider_page_id", providerPage.id);

  const updateSchedule = schedule.map((openingHour) => ({
    provider_page_id: providerPage.id,
    weekday: weekdayNameToNumber(openingHour.dayOfWeek),
    starts_at: openingHour.openTime,
    ends_at: openingHour.closeTime,
  })).filter((openingHour) => openingHour.weekday !== null);

  if (error) {
    return "Something went wrong.";
  }

  if (updateSchedule.length > 0) {
    const { error: insertError } = await supabase
      .schema("ceaute")
      .from("availability_rule")
      .insert(updateSchedule);

    if (insertError) {
      return "Something went wrong.";
    }
  }

  revalidatePath("/", "layout");
  redirect("/provider");
};
