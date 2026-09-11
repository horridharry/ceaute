"use server";
import { revalidatePath } from "next/cache";
import {
  getSignedInProvider,
  normalizeUsername,
  providerPageToProviderProfile,
} from "../_lib/provider-data";

const PROVIDER_CATEGORIES = new Set([
  "Nails",
  "Lashes",
  "Hair",
  "Brows",
  "Skincare",
  "Makeup",
]);

export const getProfile = async () => {
  const { providerPage } = await getSignedInProvider({
    next: "/provider/page",
  });

  return providerPageToProviderProfile(providerPage);
};

export const updateProfile = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/page",
  });

  const displayName = String(formData.get("business_name") ?? "").trim();
  const username = normalizeUsername(formData.get("username"));
  const providerCategory = String(
    formData.get("provider_category") ?? "",
  ).trim();
  const biography = String(formData.get("biography") ?? "").trim();

  const newProfileDetails = {
    username: username || null,
    display_name: displayName || null,
    provider_category: providerCategory || null,
    biography: biography || null,
  };

  if (displayName && displayName.length < 2) {
    return "Business name must be at least 2 characters long.";
  }

  if (username && (username.length < 3 || username.length > 30)) {
    return "Username must be between 3 and 30 characters long.";
  }

  if (providerCategory && !PROVIDER_CATEGORIES.has(providerCategory)) {
    return "Choose one of the available provider categories.";
  }

  if (biography.length > 500) {
    return "Biography must be 500 characters or fewer.";
  }

  if (username) {
    const { data: existingPage, error: usernameError } = await supabase
      .schema("ceaute")
      .from("provider_page")
      .select("id")
      .ilike("username", username)
      .neq("id", providerPage.id)
      .maybeSingle();

    if (usernameError) {
      return "Could not check that username.";
    }

    if (existingPage) {
      return "That username is already taken.";
    }
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .update({ ...newProfileDetails })
    .eq("id", providerPage.id);

  if (error) {
    if (error.code === "23505") {
      return "That username is already taken.";
    }

    if (error.code === "23514") {
      return "Check the details and try again.";
    }

    return "Could not save your page details.";
  }

  revalidatePath("/", "layout");
  revalidatePath("/provider/page");
  return "Saved.";
};
