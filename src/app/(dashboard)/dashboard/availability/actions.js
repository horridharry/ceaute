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
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayInLondon() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function isValidLocalDate(value) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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
    next: "/dashboard/availability",
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

  revalidatePath("/dashboard/availability");
  revalidatePath("/", "layout");
  return "Saved.";
};

export const blockDate = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });
  const localDate = String(formData.get("local_date") ?? "").trim();

  if (!isValidLocalDate(localDate)) {
    return "Choose a valid date to block.";
  }

  if (localDate < todayInLondon()) {
    return "Choose today or a future date.";
  }

  const { error } = await supabase.schema("ceaute").from("blocked_date").insert({
    provider_page_id: providerPage.id,
    local_date: localDate,
  });

  if (error) {
    if (error.code === "23505") {
      return "That date is already blocked.";
    }

    return "Could not block that date.";
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/", "layout");
  return "Date blocked.";
};

export const removeBlockedDate = async (formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });
  const blockedDateId = String(formData.get("blocked_date_id") ?? "").trim();

  if (!blockedDateId) {
    return;
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("blocked_date")
    .delete()
    .eq("provider_page_id", providerPage.id)
    .eq("id", blockedDateId);

  if (error) {
    throw new Error("Could not remove blocked date.");
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/", "layout");
};
