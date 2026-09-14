"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSignedInProvider } from "../../_lib/provider-data";

const BUCKET_NAME = "portfolio-images";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

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

export const getPortfolioImages = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page/portfolio",
  });

  const { data: images, error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select("id, storage_path, caption, display_order, is_visible")
    .eq("provider_page_id", providerPage.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Could not load portfolio.");
  }

  return Promise.all(
    (images ?? []).map(async (image) => {
      const { data } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(image.storage_path, 60 * 60);

      return {
        ...image,
        signed_url: data?.signedUrl ?? "",
      };
    }),
  );
};

export const uploadPortfolioImage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page/portfolio",
  });

  const file = formData.get("image");
  const caption = cleanCaption(formData.get("caption"));

  if (!(file instanceof File) || file.size === 0) {
    return "Choose an image to upload.";
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Upload a JPEG, PNG, or WebP image.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Image must be 5 MB or smaller.";
  }

  if (caption && caption.length > 250) {
    return "Caption must be 250 characters or fewer.";
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
    return "Could not upload that image.";
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
      return "Could not save that portfolio image.";
    }
  } catch {
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    return "Could not save that portfolio image.";
  }

  revalidatePath("/dashboard/page/portfolio");
  return "Uploaded.";
};

export const updatePortfolioImageCaption = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");
  const caption = cleanCaption(formData.get("caption"));

  if (!imageId) {
    return "Choose an image to update.";
  }

  if (caption && caption.length > 250) {
    return "Caption must be 250 characters or fewer.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .update({ caption })
    .eq("provider_page_id", providerPage.id)
    .eq("id", imageId);

  if (error) {
    return "Could not update that caption.";
  }

  revalidatePath("/dashboard/page/portfolio");
  return "Saved.";
};

export const setPortfolioImageVisibility = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");
  const isVisible = String(formData.get("is_visible") ?? "") === "true";

  if (!imageId) {
    return "Choose an image to update.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .update({ is_visible: isVisible })
    .eq("provider_page_id", providerPage.id)
    .eq("id", imageId);

  if (error) {
    return "Could not update that image.";
  }

  revalidatePath("/dashboard/page/portfolio");
  return isVisible ? "Image shown." : "Image hidden.";
};

export const movePortfolioImage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (!imageId || !["up", "down"].includes(direction)) {
    return "Choose an image to move.";
  }

  const { data: images, error } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .select("id, display_order")
    .eq("provider_page_id", providerPage.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return "Could not reorder portfolio images.";
  }

  const currentIndex = (images ?? []).findIndex((image) => image.id === imageId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const currentImage = images?.[currentIndex];
  const targetImage = images?.[targetIndex];

  if (!currentImage || !targetImage) {
    return "That image cannot move further.";
  }

  const firstUpdate = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .update({ display_order: targetImage.display_order })
    .eq("provider_page_id", providerPage.id)
    .eq("id", currentImage.id);

  if (firstUpdate.error) {
    return "Could not reorder portfolio images.";
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
    return "Could not reorder portfolio images.";
  }

  revalidatePath("/dashboard/page/portfolio");
  return "Moved.";
};

export const deletePortfolioImage = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/page/portfolio",
  });
  const imageId = String(formData.get("image_id") ?? "");

  if (!imageId) {
    return "Choose an image to delete.";
  }

  const image = await getPortfolioImage(supabase, providerPage.id, imageId);

  if (!image) {
    return "Could not find that image.";
  }

  const { error: removeError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([image.storage_path]);

  if (removeError) {
    return "Could not delete the stored image.";
  }

  const { error: deleteError } = await supabase
    .schema("ceaute")
    .from("portfolio_image")
    .delete()
    .eq("provider_page_id", providerPage.id)
    .eq("id", image.id);

  if (deleteError) {
    return "The file was removed, but the image record could not be deleted.";
  }

  revalidatePath("/dashboard/page/portfolio");
  return "Deleted.";
};
