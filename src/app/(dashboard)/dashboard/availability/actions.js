"use server";
import { revalidatePath } from "next/cache";
import { getSignedInProvider } from "../_lib/provider-data";
import { parseSchedule } from "./_lib/schedule-form";
import { todayInLondon } from "./_lib/today-london";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export const updateSchedule = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });
  const parsedSchedule = parseSchedule(formData);

  if (parsedSchedule.error) {
    return { status: "error", message: parsedSchedule.error };
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
      return {
        status: "error",
        message:
          "Choose 15-minute opening and closing times, with closing after opening.",
      };
    }

    if (error.code === "23505") {
      return {
        status: "error",
        message: "Each weekday can only be saved once.",
      };
    }

    return { status: "error", message: "Could not save availability." };
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/", "layout");
  return { status: "saved" };
};

export const blockDate = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });
  const localDate = String(formData.get("local_date") ?? "").trim();

  if (!isValidLocalDate(localDate)) {
    return { status: "error", message: "Choose a valid date to block." };
  }

  if (localDate < todayInLondon()) {
    return { status: "error", message: "Choose today or a future date." };
  }

  const { error } = await supabase.schema("ceaute").from("blocked_date").insert({
    provider_page_id: providerPage.id,
    local_date: localDate,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "That date is already blocked." };
    }

    return { status: "error", message: "Could not block that date." };
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/", "layout");
  return { status: "blocked", localDate };
};

const REMOVE_BLOCKED_DATE_ERROR = {
  status: "error",
  message: "Could not remove that date. Try again.",
};

export const removeBlockedDate = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });
  const blockedDateId = String(formData.get("blocked_date_id") ?? "").trim();

  if (!blockedDateId) {
    return REMOVE_BLOCKED_DATE_ERROR;
  }

  const { data, error } = await supabase
    .schema("ceaute")
    .from("blocked_date")
    .delete()
    .eq("provider_page_id", providerPage.id)
    .eq("id", blockedDateId)
    .select("local_date");

  if (error) {
    return REMOVE_BLOCKED_DATE_ERROR;
  }

  // A row that is already gone counts as removed: the date is unblocked either
  // way, so the page still refreshes and localDate is null.
  revalidatePath("/dashboard/availability");
  revalidatePath("/", "layout");
  return { status: "removed", localDate: data?.[0]?.local_date ?? null };
};
