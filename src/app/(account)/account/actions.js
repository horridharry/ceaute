"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validatePersonalDetails } from "@/lib/profile/personal-details";
import { createClient } from "@/lib/supabase/server";

// Writes the same two profile columns Review and pay writes, through the
// signed-in client so profile_update_own_booking_details applies.
export async function updatePersonalDetails(_currentState, formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    redirect("/sign-in?next=%2Faccount");
  }

  const parsed = validatePersonalDetails({
    fullName: formData.get("full_name"),
    phone: formData.get("phone"),
  });

  if (parsed.errors) {
    return { status: "error", fieldErrors: parsed.errors, message: "" };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update(parsed.values)
    .eq("id", profileId);

  if (error) {
    return { status: "error", fieldErrors: {}, message: "We couldn’t save your details. Try again." };
  }

  // The header's initial comes from the name.
  revalidatePath("/", "layout");
  return { status: "saved", fieldErrors: {}, message: "Saved." };
}
