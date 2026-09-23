"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSignedInProvider } from "../../_lib/provider-data";
import { deleteRowThenFile } from "./_lib/portfolio-deletion";
import { describePortfolioChangeError } from "./_lib/portfolio-messages";
import { BUCKET_NAME } from "./_lib/portfolio-storage";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

// Every action returns { status: "done" | "error", message } so the screen can
// announce a result as a status and a failure as an error.
const cleanCaption = (value) => {
  const caption = String(value ?? "").trim();
  return caption || null;
};

async function getPortfolioImage(supabase, providerPageId, imageId) {
  const { data: image, error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select(
      "id, provider_page_id, storage_path, caption, display_order, is_visible",
    )
    .eq("provider_page_id", providerPageId)
    .eq("id", imageId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load portfolio image.");
  }

  return image;
}

async function getNextDisplayOrder(supabase, providerPageId) {
  const { data: latestImage, error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select("display_order")
    .eq("provider_page_id", providerPageId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Could not choose portfolio image order.");
  }

  return (latestImage?.display_order ?? 0) + 10;
}

export const uploadPortfolioImage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/portfolio",
  });

  const file = formData.get("image");
  const caption = cleanCaption(formData.get("caption"));

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image to upload." };
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { status: "error", message: "Upload a JPEG, PNG, or WebP image." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { status: "error", message: "Image must be 5 MB or smaller." };
  }

  if (caption && caption.length > 250) {
    return { status: "error", message: "Caption must be 250 characters or fewer." };
  }

  const imageId = randomUUID();
  const extension = ALLOWED_IMAGE_TYPES.get(file.type);
  const storagePath = `${providerPage.id}/${imageId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { status: "error", message: "Could not upload that image." };
  }

  try {
    const displayOrder = await getNextDisplayOrder(supabase, providerPage.id);
    const { error: insertError } = await supabase
      .schema("ceaute")
      .from("portfolio_image")
      .insert({
        id: imageId,
        provider_page_id: providerPage.id,
        storage_path: storagePath,
        caption,
        display_order: displayOrder,
        is_visible: true,
      });

    if (insertError) {
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      return { status: "error", message: "Could not save that portfolio image." };
    }
  } catch {
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    return { status: "error", message: "Could not save that portfolio image." };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/[username]", "layout");
  return { status: "done", message: "Photo added." };
};

export const updatePortfolioImageCaption = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");
  const caption = cleanCaption(formData.get("caption"));

  if (!imageId) {
    return { status: "error", message: "Choose an image to update." };
  }

  if (caption && caption.length > 250) {
    return { status: "error", message: "Caption must be 250 characters or fewer." };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .update({ caption })
    .eq("provider_page_id", providerPage.id)
    .eq("id", imageId);

  if (error) {
    return { status: "error", message: "Could not update that caption." };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/[username]", "layout");
  return { status: "done", message: "Caption saved." };
};

export const setPortfolioImageVisibility = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");
  const isVisible = String(formData.get("is_visible") ?? "") === "true";

  if (!imageId) {
    return { status: "error", message: "Choose an image to update." };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .update({ is_visible: isVisible })
    .eq("provider_page_id", providerPage.id)
    .eq("id", imageId);

  if (error) {
    return {
      status: "error",
      message: describePortfolioChangeError(error, "Could not update that image."),
    };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/[username]", "layout");
  return {
    status: "done",
    message: isVisible ? "Photo shown on your page." : "Photo hidden. Only you can see it.",
  };
};

export const movePortfolioImage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (!imageId || !["up", "down"].includes(direction)) {
    return { status: "error", message: "Choose an image to move." };
  }

  const { data: images, error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select("id, display_order")
    .eq("provider_page_id", providerPage.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { status: "error", message: "Could not reorder portfolio images." };
  }

  const currentIndex = (images ?? []).findIndex((image) => image.id === imageId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const currentImage = images?.[currentIndex];
  const targetImage = images?.[targetIndex];

  if (!currentImage || !targetImage) {
    return { status: "error", message: "That image cannot move further." };
  }

  const firstUpdate = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .update({ display_order: targetImage.display_order })
    .eq("provider_page_id", providerPage.id)
    .eq("id", currentImage.id);

  if (firstUpdate.error) {
    return { status: "error", message: "Could not reorder portfolio images." };
  }

  const secondUpdate = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .update({ display_order: currentImage.display_order })
    .eq("provider_page_id", providerPage.id)
    .eq("id", targetImage.id);

  if (secondUpdate.error) {
    await supabase
      .schema("ceaute")
      .from("portfolio_image")
      .update({ display_order: currentImage.display_order })
      .eq("provider_page_id", providerPage.id)
      .eq("id", currentImage.id);
    return { status: "error", message: "Could not reorder portfolio images." };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/[username]", "layout");
  return {
    status: "done",
    message: `Moved to position ${targetIndex + 1} of ${images.length}.`,
  };
};

// Row first, then file: see _lib/portfolio-deletion.js.
export const deletePortfolioImage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/profile/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");

  if (!imageId) {
    return { status: "error", message: "Choose an image to delete." };
  }

  const image = await getPortfolioImage(supabase, providerPage.id, imageId);

  if (!image) {
    return { status: "error", message: "Could not find that image." };
  }

  const result = await deleteRowThenFile({
    deleteRow: () =>
      supabase
        .schema("ceaute")
        .from("portfolio_image")
        .delete()
        .eq("provider_page_id", providerPage.id)
        .eq("id", image.id),
    removeFile: () => supabase.storage.from(BUCKET_NAME).remove([image.storage_path]),
    onOrphan: (fileError) =>
      console.error("[portfolio] stored file left after its image was deleted", {
        imageId: image.id,
        message: fileError.message,
      }),
  });

  if (result.status === "refused") {
    return {
      status: "error",
      message: describePortfolioChangeError(result.error, "Could not delete that image."),
    };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/[username]", "layout");
  return { status: "done", message: "Photo deleted." };
};
