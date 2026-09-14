"use server";
import { revalidatePath } from "next/cache";
import {
  getSignedInProvider,
  normalizeUsername,
  providerPageToFormValues,
} from "../_lib/provider-data";
import { getProviderPagePublicationReadiness } from "./publication-readiness";

const PROVIDER_CATEGORIES = new Set([
  "Nails",
  "Lashes",
  "Hair",
  "Brows",
  "Skincare",
  "Makeup",
]);

export const getProviderPage = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page",
  });
  const publication = await getProviderPagePublicationReadiness({
    supabase,
    providerPage,
  });

  return {
    providerPage: providerPageToFormValues(providerPage),
    publication,
  };
};

export const updateProviderPage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page",
  });

  const displayName = String(formData.get("business_name") ?? "").trim();
  const username = normalizeUsername(formData.get("username"));
  const providerCategory = String(
    formData.get("provider_category") ?? "",
  ).trim();
  const biography = String(formData.get("biography") ?? "").trim();

  const providerPageValues = {
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
    .update(providerPageValues)
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
  revalidatePath("/dashboard/page");
  return "Saved.";
};

export const publishPage = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page",
  });

  if (providerPage.status === "suspended") {
    return "Suspended pages cannot be published.";
  }

  const publication = await getProviderPagePublicationReadiness({
    supabase,
    providerPage,
  });

  if (!publication.ready) {
    return "Complete the missing publication requirements first.";
  }

  const { error } = await supabase.schema("ceaute").rpc(
    "publish_provider_page",
  );

  if (error) {
    return "Could not publish your page.";
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/page");
  return "Published.";
};

export const unpublishPage = async () => {
  const { supabase } = await getSignedInProvider({
    next: "/dashboard/page",
  });

  const { error } = await supabase.schema("ceaute").rpc(
    "unpublish_provider_page",
  );

  if (error) {
    return "Could not unpublish your page.";
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/page");
  return "Unpublished.";
};
