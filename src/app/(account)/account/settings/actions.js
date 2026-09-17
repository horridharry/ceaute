"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePersonalDetails } from "@/lib/profile/personal-details";
import { createClient } from "@/lib/supabase/server";

const SETTINGS_PATH = "/account/settings";

// Writes the same two profile columns the booking checkout writes, through the
// signed-in client so profile_update_own_booking_details applies.
export async function updatePersonalDetails(_currentState, formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    redirect(`/sign-in?next=${SETTINGS_PATH}`);
  }

  const parsed = parsePersonalDetails({
    fullName: formData.get("full_name"),
    phone: formData.get("phone"),
  });

  if (parsed.error) {
    return { error: true, message: parsed.error };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update(parsed.values)
    .eq("id", profileId);

  if (error) {
    return { error: true, message: "Could not save your details." };
  }

  revalidatePath(SETTINGS_PATH);
  return { error: false, message: "Saved." };
}
