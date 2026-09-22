"use client";

import { useActionState, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DISPLAY_PHOTO_ACCEPT } from "@/lib/providers/display-photo";

// The optional display photo shown next to the provider's name on their page,
// directly under the Profile heading. Choosing a file saves it straight away,
// as Remove does; it is separate from Portfolio and not needed to publish.
export function DisplayPhotoForm({ photoUrl, uploadDisplayPhoto, removeDisplayPhoto }) {
  const inputId = useId();
  const hintId = useId();
  const uploadFormRef = useRef(null);
  const inputRef = useRef(null);
  const [uploadMessage, uploadAction, uploading] = useActionState(uploadDisplayPhoto, "");
  const [removeMessage, removeAction, removing] = useActionState(removeDisplayPhoto, "");
  const message = uploading || removing ? "" : uploadMessage || removeMessage;
  const busy = uploading || removing;

  return (
    <section aria-label="Display photo" className="mt-5">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Short-lived signed storage URL.
          <img src={photoUrl} alt="Your display photo" className="h-16 w-16 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="h-16 w-16 shrink-0 rounded-full border border-dashed border-line-strong bg-surface-subtle" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap gap-1">
            <form ref={uploadFormRef} action={uploadAction}>
              <label htmlFor={inputId} className="sr-only">
                {photoUrl ? "Choose a new display photo" : "Choose a display photo"}
              </label>
              <input
                ref={inputRef}
                id={inputId}
                name="display_photo"
                type="file"
                accept={DISPLAY_PHOTO_ACCEPT}
                aria-describedby={hintId}
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  if (event.currentTarget.files?.length) uploadFormRef.current?.requestSubmit();
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="compact"
                disabled={busy}
                aria-describedby={hintId}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add photo"}
              </Button>
            </form>
            {photoUrl ? (
              <form action={removeAction}>
                <Button type="submit" variant="text" size="compact" className="px-3 text-ink-muted" disabled={busy}>
                  {removing ? "Removing…" : "Remove"}
                </Button>
              </form>
            ) : null}
          </div>
          <p id={hintId} className="text-[13px] text-ink-muted">
            Optional. Shown next to your name. JPEG, PNG or WebP up to 5 MB.
          </p>
        </div>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-ink-muted">
        {message}
      </p>
    </section>
  );
}
