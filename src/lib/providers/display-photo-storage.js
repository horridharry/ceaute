// Saving and clearing the optional display photo. Both run with the signed-in
// owner's own Supabase client, so storage and database policies confine them
// to the owner's folder and page; the path is always generated here, never
// taken from the request.
//
// Orphans are cleaned up in two ways:
// - the page's path only changes if it still holds the path this request
//   read (compare-and-set), so of two overlapping saves one is refused and
//   removes its own upload instead of silently orphaning the other's;
// - after every successful save or removal, anything else in the owner's
//   folder is deleted, keeping only the path the page holds at that moment.
//   This also collects files left behind by an earlier failed cleanup.
import {
  DISPLAY_PHOTO_BUCKET,
  displayPhotoStoragePath,
} from "./display-photo";

export const DISPLAY_PHOTO_CONFLICT_MESSAGE =
  "Your photo was changed somewhere else. Reload the page and try again.";

// Paths in the owner's folder other than the one to keep. Storage lists a
// placeholder object for empty folders, which is not a photo.
export function strayDisplayPhotoPaths({ folder, names, keepPath }) {
  return names
    .filter((name) => name && name !== ".emptyFolderPlaceholder")
    .map((name) => `${folder}/${name}`)
    .filter((path) => path !== keepPath);
}

function providerPages(supabase) {
  return supabase.schema("ceaute").from("provider_page");
}

// Sets display_photo_path from `expectedPath` to `nextPath` and reports
// whether the row changed. `expectedPath` null means "no photo yet".
async function compareAndSetPath(supabase, providerPageId, expectedPath, nextPath) {
  let update = providerPages(supabase)
    .update({ display_photo_path: nextPath })
    .eq("id", providerPageId);

  update = expectedPath
    ? update.eq("display_photo_path", expectedPath)
    : update.is("display_photo_path", null);

  const { data, error } = await update.select("id");

  if (error) {
    return { changed: false, error };
  }

  return { changed: (data ?? []).length > 0, error: null };
}

async function currentPath(supabase, providerPageId) {
  const { data, error } = await providerPages(supabase)
    .select("display_photo_path")
    .eq("id", providerPageId)
    .maybeSingle();

  return error ? undefined : (data?.display_photo_path ?? null);
}

// Best effort: a failure here only postpones the cleanup to the next save.
export async function removeStrayDisplayPhotos(supabase, providerPageId) {
  const keepPath = await currentPath(supabase, providerPageId);

  if (keepPath === undefined) {
    return;
  }

  const storage = supabase.storage.from(DISPLAY_PHOTO_BUCKET);
  const { data: objects, error } = await storage.list(providerPageId, {
    limit: 100,
  });

  if (error) {
    return;
  }

  const stray = strayDisplayPhotoPaths({
    folder: providerPageId,
    names: (objects ?? []).map((object) => object.name),
    keepPath,
  });

  if (stray.length > 0) {
    await storage.remove(stray);
  }
}

// Stores `file` (already validated) and points the page at it.
export async function saveDisplayPhoto({
  supabase,
  providerPageId,
  previousPath,
  file,
  photoId,
}) {
  const storagePath = displayPhotoStoragePath({
    providerPageId,
    photoId,
    type: file.type,
  });
  const storage = supabase.storage.from(DISPLAY_PHOTO_BUCKET);
  const { error: uploadError } = await storage.upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return { ok: false, message: "Could not upload that photo." };
  }

  const { changed, error } = await compareAndSetPath(
    supabase,
    providerPageId,
    previousPath ?? null,
    storagePath,
  );

  if (error || !changed) {
    await storage.remove([storagePath]);
    return {
      ok: false,
      message: error ? "Could not save your photo." : DISPLAY_PHOTO_CONFLICT_MESSAGE,
    };
  }

  await removeStrayDisplayPhotos(supabase, providerPageId);
  return { ok: true, message: "Photo saved.", storagePath };
}

// Clears the page's photo and removes the file.
export async function clearDisplayPhoto({ supabase, providerPageId, previousPath }) {
  if (previousPath) {
    const { changed, error } = await compareAndSetPath(
      supabase,
      providerPageId,
      previousPath,
      null,
    );

    if (error) {
      return { ok: false, message: "Could not remove your photo." };
    }

    if (!changed) {
      return { ok: false, message: DISPLAY_PHOTO_CONFLICT_MESSAGE };
    }
  }

  await removeStrayDisplayPhotos(supabase, providerPageId);
  return { ok: true, message: "Photo removed." };
}
