"use client";

import { useActionState, useId, useState } from "react";
import { DISPLAY_PHOTO_ACCEPT } from "@/lib/providers/display-photo";

// The optional display photo shown next to the provider's name on their
// page. It is separate from Portfolio and not needed to publish.
export function DisplayPhotoForm({
  photoUrl,
  uploadDisplayPhoto,
  removeDisplayPhoto,
}) {
  const inputId = useId();
  const hintId = useId();
  const [hasFile, setHasFile] = useState(false);
  const [uploadMessage, uploadAction, uploading] = useActionState(
    uploadDisplayPhoto,
    "",
  );
  const [removeMessage, removeAction, removing] = useActionState(
    removeDisplayPhoto,
    "",
  );
  const message = uploading || removing ? "" : uploadMessage || removeMessage;
  const busy = uploading || removing;

  return (
    <section className="mt-8" aria-labelledby={`${inputId}-heading`}>
      <h2 id={`${inputId}-heading`} className="text-lg font-semibold">
        Display photo
      </h2>
      <p id={hintId} className="mt-1 text-sm text-black/60">
        Optional. Shown next to your name on your page. JPEG, PNG or WebP, up
        to 5 MB.
      </p>

      <div className="mt-4 flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URL.
          <img
            src={photoUrl}
            alt="Your display photo"
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : null}

        <form
          action={uploadAction}
          onSubmit={() => setHasFile(false)}
          className="flex min-w-0 flex-1 flex-col gap-3"
        >
          <label htmlFor={inputId} className="sr-only">
            {photoUrl ? "Choose a new display photo" : "Choose a display photo"}
          </label>
          <input
            id={inputId}
            name="display_photo"
            type="file"
            accept={DISPLAY_PHOTO_ACCEPT}
            aria-describedby={hintId}
            onChange={(event) =>
              setHasFile(Boolean(event.currentTarget.files?.length))
            }
            className="min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-black/10 file:bg-white file:px-4 file:text-sm file:font-semibold"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!hasFile || busy}
              className="min-h-11 rounded-lg bg-pink-700 px-4 text-sm font-semibold text-white duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? "Uploading..."
                : photoUrl
                  ? "Replace photo"
                  : "Upload photo"}
            </button>
            {photoUrl ? (
              <button
                type="submit"
                form={`${inputId}-remove`}
                disabled={busy}
                className="min-h-11 rounded-lg border border-black/10 px-4 text-sm font-semibold text-black/70 duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove photo"}
              </button>
            ) : null}
          </div>
        </form>
        {/* Removing sends nothing, so it has its own empty form. */}
        {photoUrl ? <form id={`${inputId}-remove`} action={removeAction} /> : null}
      </div>

      <p role="status" className="mt-3 min-h-5 text-sm text-black/70">
        {message}
      </p>
    </section>
  );
}
