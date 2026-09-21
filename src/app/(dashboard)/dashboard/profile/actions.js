"use server";
import { revalidatePath } from "next/cache";
import { getSignedInProvider } from "../_lib/provider-data";
import { usernameRequiredError } from "@/lib/providers/username";
import {
  isProviderCategory,
  providerPageValuesFromFormData,
} from "./_lib/provider-page-form-values";
import { getProviderPagePublicationReadiness } from "./publication-readiness";
import { publicationFailure, publicationSuccess } from "./publication-outcome";

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
    return "Business name must be at least 2 characters long.";
  }

  if (username && (username.length < 3 || username.length > 30)) {
    return "Username must be between 3 and 30 characters long.";
  }

  const usernameError = usernameRequiredError({
    username,
    status: providerPage.status,
  });

  if (usernameError) {
    return usernameError;
  }

  if (providerCategory && !isProviderCategory(providerCategory)) {
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
    .update(providerPageValues)
    .eq("id", providerPage.id);

  if (error) {
    if (error.code === "23505") {
      return "That username is already taken.";
    }

    if (
      error.code === "23514" &&
      String(error.message ?? "").includes(
        "provider_page_published_requires_username",
      )
    ) {
      return usernameRequiredError({ username: "", status: "published" });
    }

    if (error.code === "23514") {
      return "Check the details and try again.";
    }

    return "Could not save your page details.";
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/profile");
  return "Saved.";
};

// Both publication actions return { error, message } so the screen can show
// the outcome; PostgreSQL's publish_provider_page re-checks every requirement
// and its rejection reason is what the provider needs to see.
export const publishPage = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile",
  });

  if (providerPage.status === "suspended") {
    return publicationFailure(
      { message: "Suspended pages cannot be published." },
      "publish",
    );
  }

  const publication = await getProviderPagePublicationReadiness({
    supabase,
    providerPage,
  });

  if (!publication.ready) {
    return publicationFailure(
      { message: "Publication requirements are incomplete." },
      "publish",
    );
  }

  const { error } = await supabase.schema("ceaute").rpc(
    "publish_provider_page",
  );

  if (error) {
    return publicationFailure(error, "publish");
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/profile");
  return publicationSuccess("publish");
};

export const unpublishPage = async () => {
  const { supabase } = await getSignedInProvider({
    next: "/dashboard/profile",
  });

  const { error } = await supabase.schema("ceaute").rpc(
    "unpublish_provider_page",
  );

  if (error) {
    return publicationFailure(error, "unpublish");
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/profile");
  return publicationSuccess("unpublish");
};
