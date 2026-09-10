"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSignedInProvider,
  normalizeUsername,
  providerPageToDashboardProfile,
} from "../_lib/provider-data";

export const getProfile = async () => {
  const { providerPage } = await getSignedInProvider({
    next: "/provider/profile",
  });

  return providerPageToDashboardProfile(providerPage);
};

export const updateProfile = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/profile",
  });

  const newProfileDetails = {
    username: normalizeUsername(formData.get("username")),
    display_name: String(formData.get("business_name") ?? "").trim(),
  };

  if (newProfileDetails.display_name.length < 2) {
    return "Please enter a business name.";
  }

  if (
    newProfileDetails.username.length < 3 ||
    newProfileDetails.username.length > 30
  ) {
    return "Username must be between 3 and 30 characters long.";
  }

  const { data: existingPage, error: usernameError } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .select("id")
    .eq("username", newProfileDetails.username)
    .neq("id", providerPage.id)
    .maybeSingle();

  if (usernameError) {
    return "Something went wrong.";
  }

  if (existingPage) {
    return "Username already exists.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .update({ ...newProfileDetails })
    .eq("id", providerPage.id);

  if (error) {
    return "Something went wrong.";
  }

  revalidatePath("/", "layout");
  redirect("/provider");
};
