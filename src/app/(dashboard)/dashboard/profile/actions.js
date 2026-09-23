"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { displayPhotoUploadError } from "@/lib/providers/display-photo";
import {
  clearDisplayPhoto,
  saveDisplayPhoto,
} from "@/lib/providers/display-photo-storage";
import { getSignedInProvider } from "../_lib/provider-data";
import { usernameRequiredError, validateUsername } from "@/lib/providers/username";
import {
  isProviderCategory,
  providerPageValuesFromFormData,
} from "./_lib/provider-page-form-values";

// Returns { status: "saved" | "error", message }.
export const updateProviderPage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile",
  });

  const {
    displayName,
    username,
    providerCategory,
    biography,
    providerPageValues,
  } = providerPageValuesFromFormData(formData);

  if (displayName && displayName.length < 2) {
    return { status: "error", message: "Business name must be at least 2 characters long." };
  }

  const usernameFormatError = validateUsername(username);

  if (usernameFormatError) {
    return { status: "error", message: usernameFormatError };
  }

  const usernameError = usernameRequiredError({
    username,
    status: providerPage.status,
  });

  if (usernameError) {
    return { status: "error", message: usernameError };
  }

  if (providerCategory && !isProviderCategory(providerCategory)) {
    return { status: "error", message: "Choose one of the available provider categories." };
  }

  if (biography.length > 500) {
    return { status: "error", message: "Biography must be 500 characters or fewer." };
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
      return { status: "error", message: "Could not check that username." };
    }

    if (existingPage) {
      return { status: "error", message: "That username is already taken." };
    }
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .update(providerPageValues)
    .eq("id", providerPage.id);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "That username is already taken." };
    }

    if (
      error.code === "23514" &&
      String(error.message ?? "").includes(
        "provider_page_published_requires_username",
      )
    ) {
      return {
        status: "error",
        message: usernameRequiredError({ username: "", status: "published" }),
      };
    }

    if (error.code === "23514") {
      return { status: "error", message: "Check the details and try again." };
    }

    return { status: "error", message: "Could not save your page details." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/profile");
  return { status: "saved", message: "Saved." };
};

// Adds or replaces the optional display photo. The new file is stored and
// the page pointed at it before anything is deleted, so a failure keeps the
// existing photo; see lib/providers/display-photo-storage.js for how
// overlapping saves and leftover files are handled.
export const uploadDisplayPhoto = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile",
  });
  const file = formData.get("display_photo");

  if (!(file instanceof File)) {
    return "Choose a photo to upload.";
  }

  const headBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const uploadError = displayPhotoUploadError({
    type: file.type,
    size: file.size,
    headBytes,
  });

  if (uploadError) {
    return uploadError;
  }

  const result = await saveDisplayPhoto({
    supabase,
    providerPageId: providerPage.id,
    previousPath: providerPage.display_photo_path,
    file,
    photoId: randomUUID(),
  });

  if (result.ok) {
    revalidatePath("/dashboard/profile");
  }

  return result.message;
};

export const removeDisplayPhoto = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile",
  });
  const result = await clearDisplayPhoto({
    supabase,
    providerPageId: providerPage.id,
    previousPath: providerPage.display_photo_path,
  });

  if (result.ok) {
    revalidatePath("/dashboard/profile");
  }

  return result.message;
};
