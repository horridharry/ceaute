"use server";
import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { getSignedInProvider } from "../_lib/provider-data";
import {
  DROP_TIME_PASSED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  TIMES_MESSAGE,
  parseDropForm,
} from "./_lib/drop-form";

// PostgreSQL's reasons, in the provider's words. Anything else is the plain
// failure message; raw database text is never shown.
function saveErrorMessage(error) {
  const message = String(error?.message ?? "");

  if (message.includes("Drop time has passed")) {
    return DROP_TIME_PASSED_MESSAGE;
  }

  if (message.includes("Date is in another drop")) {
    return "That date is already in another drop.";
  }

  if (message.includes("Choose dates from today on")) {
    return "Choose dates from today on.";
  }

  if (error?.code === "23514") {
    return TIMES_MESSAGE;
  }

  return SAVE_FAILED_MESSAGE;
}

// Saves one drop's dates, times and drop time together through
// save_availability_drop, which checks every rule again and owns the write.
// On success it returns to the list; on failure it returns the message and
// the editor keeps the provider's input.
export const saveDrop = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/availability",
  });
  const parsed = parseDropForm(formData);

  if (parsed.error) {
    return { status: "error", message: parsed.error };
  }

  const { dropId, opensOn, opensTime, dates } = parsed.value;
  const { error } = await supabase.schema("ceaute").rpc("save_availability_drop", {
    target_provider_page_id: providerPage.id,
    target_drop_id: dropId,
    opens_on: opensOn,
    opens_time: opensTime,
    drop_dates: dates,
  });

  if (error) {
    return { status: "error", message: saveErrorMessage(error) };
  }

  revalidatePath("/dashboard/availability");
  revalidatePath("/", "layout");
  // Replace, not push: Back from the list after a save must not reopen the
  // editor (usability test, 27 September 2026).
  redirect("/dashboard/availability", RedirectType.replace);
};
