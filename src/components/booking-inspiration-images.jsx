"use client";

import { useActionState, useState } from "react";
import { buttonClassName } from "@/components/ui/button-classes";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_LIMIT = 5;

function describeAllowance(used) {
  return {
    used,
    limit: IMAGE_LIMIT,
    remaining: Math.max(0, IMAGE_LIMIT - used),
    isFull: used >= IMAGE_LIMIT,
  };
}

// The same check the server action and the Storage bucket make, said early so a
// wrong file is caught before it is uploaded. It is a courtesy, not the rule.
function describeChosenFiles(files, remaining) {
  if (files.length === 0) {
    return "";
  }

  if (files.length > remaining) {
    return `You can add ${remaining} more ${remaining === 1 ? "photo" : "photos"}.`;
  }

  if (files.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type))) {
    return "Choose JPEG, PNG or WebP photos.";
  }

  if (files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
    return "Each photo must be 10 MB or smaller.";
  }

  return "";
}

function HiddenFields({ fields }) {
  return Object.entries(fields ?? {}).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}

function AddImagesForm({ addAction, remaining, hiddenFields }) {
  const [message, formAction, pending] = useActionState(addAction, "");
  const [chosenFiles, setChosenFiles] = useState([]);

  // Worked out while rendering rather than kept in state, because how many more
  // images are allowed changes underneath this form: removing one somewhere
  // above revalidates the screen and `remaining` goes up. A message stored when
  // the files were picked would still be refusing an upload the booking now has
  // room for, with the count beside it saying the opposite.
  const fileError = describeChosenFiles(chosenFiles, remaining);

  const onChooseFiles = (event) => {
    setChosenFiles([...(event.target.files ?? [])]);
  };

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <HiddenFields fields={hiddenFields} />
      <label className="label" htmlFor="inspiration_images">
        Add photos
      </label>
      <input
        id="inspiration_images"
        name="image"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={onChooseFiles}
        className="field cursor-pointer"
      />
      <p className="text-xs text-ink-muted">
        JPEG, PNG or WebP. Up to 10 MB each.
      </p>
      {fileError ? <p className="text-sm text-danger">{fileError}</p> : null}
      {message ? <p role="status" className="text-sm text-ink-muted">{message}</p> : null}
      <div className="flex justify-end">
        {/* Deliberately not disabled on an empty selection. React clears the
            input once the action finishes, and a button left armed over an
            emptied input is better than one that looks broken: the action
            answers an empty submission by asking for an image. */}
        <button
          type="submit"
          disabled={pending || Boolean(fileError)}
          aria-disabled={pending || Boolean(fileError)}
          className={buttonClassName({ variant: "secondary", className: "w-max" })}
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}

function RemoveImageForm({ image, removeAction, hiddenFields }) {
  const [message, formAction, pending] = useActionState(removeAction, "");

  return (
    <form action={formAction} className="mt-2 flex flex-col items-start">
      <HiddenFields fields={hiddenFields} />
      <input type="hidden" name="image_id" value={image.id} />
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={buttonClassName({ variant: "destructive", size: "compact", className: "-ml-3 min-h-11" })}
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {message ? (
        <p role="status" className="mt-1 text-xs text-ink-muted">{message}</p>
      ) : null}
    </form>
  );
}

export function BookingInspirationImages({
  images,
  // A screen that only shows the images, like the provider's, has no allowance
  // to state. Defaulting keeps that caller from having to invent one.
  allowance = null,
  canManage = false,
  addAction,
  removeAction,
  description,
  // What each screen's actions need in order to know which booking this is and
  // where to send the customer back to.
  hiddenFields = {},
}) {
  const shownAllowance =
    allowance ?? describeAllowance(Array.isArray(images) ? images.length : 0);

  return (
    <section aria-labelledby="inspiration-heading" className="mt-10 text-sm">
      <h2 id="inspiration-heading" className="text-xl font-semibold tracking-tight">
        Inspiration photos
      </h2>
      <p className="mt-2 text-ink-muted">{description}</p>

      {images.length === 0 ? (
        <p className="mt-3 text-ink-muted">No photos added.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {images.map((image) => (
            <li key={image.id} className="list-none">
              <div
                role="img"
                aria-label="Inspiration photo"
                className="h-32 rounded-lg bg-surface-subtle bg-cover bg-center"
                style={
                  image.signed_url
                    ? { backgroundImage: `url("${image.signed_url}")` }
                    : undefined
                }
              />
              {canManage ? (
                <RemoveImageForm
                  image={image}
                  removeAction={removeAction}
                  hiddenFields={hiddenFields}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <>
          <p className="mt-4 text-ink-muted">
            {shownAllowance.isFull
              ? `You have added all ${shownAllowance.limit} photos. Remove one to add another.`
              : `${shownAllowance.used} of ${shownAllowance.limit} added. You can add ${shownAllowance.remaining} more.`}
          </p>
          {shownAllowance.isFull ? null : (
            <AddImagesForm
              addAction={addAction}
              remaining={shownAllowance.remaining}
              hiddenFields={hiddenFields}
            />
          )}
        </>
      ) : null}
    </section>
  );
}
