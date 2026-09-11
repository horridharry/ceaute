"use server";
import { revalidatePath } from "next/cache";
import {
  getSignedInProvider,
  weekdayNameToNumber,
  weekdayNumberToName,
} from "../_lib/provider-data";

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function parseSchedule(formData) {
  const enabledDays = formData
    .getAll("enabled_weekday")
    .map((day) => String(day ?? "").trim().toLowerCase());
  const uniqueEnabledDays = new Set(enabledDays);

  if (enabledDays.length !== uniqueEnabledDays.size) {
    return { error: "Each weekday can only be saved once." };
  }

  const schedule = [];

  for (const dayOfWeek of enabledDays) {
    if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
      return { error: "Choose valid weekdays only." };
    }

    const openTime = String(formData.get(`${dayOfWeek}_starts_at`) ?? "").trim();
    const closeTime = String(formData.get(`${dayOfWeek}_ends_at`) ?? "").trim();

    if (!TIME_PATTERN.test(openTime) || !TIME_PATTERN.test(closeTime)) {
      return { error: "Choose valid opening and closing times." };
    }

    if (closeTime <= openTime) {
      return { error: "Closing time must be after opening time." };
    }

    schedule.push({
      weekday: weekdayNameToNumber(dayOfWeek),
      starts_at: openTime,
      ends_at: closeTime,
    });
  }

  return { schedule };
}

export const updateSchedule = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/availability",
  });
  const parsedSchedule = parseSchedule(formData);

  if (parsedSchedule.error) {
    return parsedSchedule.error;
  }

  const { error } = await supabase.schema("ceaute").rpc(
    "replace_provider_availability_rules",
    {
      target_provider_page_id: providerPage.id,
      rules: parsedSchedule.schedule,
    },
  );

  if (error) {
    if (error.code === "23514") {
      return "Closing time must be after opening time.";
    }

    if (error.code === "23505") {
      return "Each weekday can only be saved once.";
    }

    return "Could not save availability.";
  }

  revalidatePath("/provider/availability");
  revalidatePath("/", "layout");
  return "Saved.";
};
