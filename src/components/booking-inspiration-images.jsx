"use client";

import { useActionState, useState } from "react";

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
    return `You can add ${remaining} more ${remaining === 1 ? "image" : "images"}.`;
  }

  if (files.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type))) {
    return "Choose JPEG, PNG, or WebP images.";
  }

  if (files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
    return "Each image must be 10 MB or smaller.";
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
        Add images
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
      <p className="text-xs text-black/50">
        JPEG, PNG or WebP. Up to 10 MB each.
      </p>
      {fileError ? <p className="text-sm text-red-600">{fileError}</p> : null}
      {message ? <p className="text-sm text-black/60">{message}</p> : null}
      <div className="flex justify-end">
        {/* Deliberately not disabled on an empty selection. React clears the
            input once the action finishes, and a button left armed over an
            emptied input is better than one that looks broken: the action
            answers an empty submission by asking for an image. */}
        <button
          type="submit"
          disabled={pending || Boolean(fileError)}
          aria-disabled={pending || Boolean(fileError)}
          className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-accent-600 duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          {pending ? "Uploading..." : "Upload"}
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
        className="rounded-lg p-2 px-3 text-xs font-semibold text-rose-600 duration-200 hover:bg-rose-50/80 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {pending ? "Removing..." : "Remove"}
      </button>
      {message ? (
        <p className="mt-1 text-xs text-black/60">{message}</p>
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
  // Short qualifier shown beside the label, e.g. "Optional" at checkout.
  meta = "",
  // What each screen's actions need in order to know which booking this is and
  // where to send the customer back to.
  hiddenFields = {},
}) {
  const shownAllowance =
    allowance ?? describeAllowance(Array.isArray(images) ? images.length : 0);

  return (
    <section className="mt-4 border-t pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
          Inspiration images
        </p>
        {meta ? <p className="text-xs text-black/45">{meta}</p> : null}
      </div>
      <p className="mt-2 text-sm text-black/60">{description}</p>

      {images.length === 0 ? (
        <p className="mt-3 text-sm text-black/60">No images added.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {images.map((image) => (
            <li key={image.id} className="list-none">
              <div
                role="img"
                aria-label="Inspiration image"
                className="h-32 rounded-lg bg-black/5 bg-cover bg-center"
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
          <p className="mt-4 text-sm text-black/60">
            {shownAllowance.isFull
              ? `You have added all ${shownAllowance.limit} images. Remove one to add another.`
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
