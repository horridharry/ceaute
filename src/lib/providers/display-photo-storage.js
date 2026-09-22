// Saving and clearing the optional display photo. Both run with the signed-in
// owner's own Supabase client, so storage and database policies confine them
// to the owner's folder and page; the path is always generated here, never
// taken from the request.
//
// Cleanup never deletes the photo the page currently points at:
// - The page's path changes only if it still holds the path this request
//   read (compare-and-set). Of two overlapping saves one is refused, and the
//   refused one deletes only its own, never-linked upload.
// - After a successful change, the path this request replaced is deleted.
//   Nothing points at it any more: paths are fresh random ids, and the app
//   never links an existing file again.
// - Anything else left in the owner's folder (for example after a failed
//   delete) is removed only once it is older than STRAY_MIN_AGE_MS and is
//   not the path the page holds. An upload is linked within the request that
//   made it, and a request cannot outlive the platform's function timeout
//   (300 seconds by default), so a file that old can never be one that an
//   overlapping save is about to link.
import {
  DISPLAY_PHOTO_BUCKET,
  displayPhotoStoragePath,
} from "./display-photo";

export const DISPLAY_PHOTO_CONFLICT_MESSAGE =
  "Your photo was changed somewhere else. Reload the page and try again.";

export const STRAY_MIN_AGE_MS = 60 * 60 * 1000;

// Leftover files that are safe to delete: not the path to keep, not the
// placeholder Storage lists for empty folders, and older than
// STRAY_MIN_AGE_MS. A file without a readable creation time is kept.
export function strayDisplayPhotoPaths({ folder, objects, keepPath, now }) {
  return objects
    .filter((object) => object?.name && object.name !== ".emptyFolderPlaceholder")
    .filter((object) => {
      const createdAt = Date.parse(object.created_at ?? "");
      return Number.isFinite(createdAt) && now - createdAt >= STRAY_MIN_AGE_MS;
    })
    .map((object) => `${folder}/${object.name}`)
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

// Best effort: a failure only leaves files for a later sweep.
async function removeOldStrays(supabase, providerPageId, now) {
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
    objects: objects ?? [],
    keepPath,
    now,
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
  now = Date.now(),
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
    // Never linked, so nothing can point at it.
    await storage.remove([storagePath]);
    return {
      ok: false,
      message: error ? "Could not save your photo." : DISPLAY_PHOTO_CONFLICT_MESSAGE,
    };
  }

  if (previousPath && previousPath !== storagePath) {
    await storage.remove([previousPath]);
  }

  await removeOldStrays(supabase, providerPageId, now);
  return { ok: true, message: "Photo saved.", storagePath };
}

// Clears the page's photo and deletes the file.
export async function clearDisplayPhoto({
  supabase,
  providerPageId,
  previousPath,
  now = Date.now(),
}) {
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

    await supabase.storage.from(DISPLAY_PHOTO_BUCKET).remove([previousPath]);
  }

  await removeOldStrays(supabase, providerPageId, now);
  return { ok: true, message: "Photo removed." };
}
