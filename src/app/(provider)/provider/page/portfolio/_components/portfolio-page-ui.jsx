"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function UploadForm({ uploadPortfolioImage }) {
  const [stateMessage, uploadAction, pending] = useActionState(
    uploadPortfolioImage,
    "",
  );
  const [fileError, setFileError] = useState("");
  const [captionError, setCaptionError] = useState("");

  const validateFile = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setFileError("");
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFileError("Upload a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError("Image must be 5 MB or smaller.");
      return;
    }

    setFileError("");
  };

  const validateCaption = (event) => {
    setCaptionError(
      event.target.value.length > 250
        ? "Caption must be 250 characters or fewer."
        : "",
    );
  };

  const hasError = Boolean(fileError || captionError);

  return (
    <form className="mt-8 flex flex-col gap-4" action={uploadAction}>
      <span className="field-set">
        <label className="label" htmlFor="image">
          Image
        </label>
        <p className="text-sm text-red-600">{fileError}</p>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={validateFile}
          className="field cursor-pointer"
        />
      </span>

      <span className="field-set">
        <label className="label" htmlFor="caption">
          Caption
        </label>
        <p className="text-sm text-red-600">{captionError}</p>
        <input
          id="caption"
          name="caption"
          maxLength={250}
          onChange={validateCaption}
          className="field"
        />
      </span>

      <p className="text-sm text-red-600">{stateMessage}</p>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || hasError}
          aria-disabled={pending || hasError}
          className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {pending ? "Uploading..." : "Upload image"}
        </button>
      </div>
    </form>
  );
}

function CaptionForm({ image, updatePortfolioImageCaption }) {
  const [stateMessage, updateAction, pending] = useActionState(
    updatePortfolioImageCaption,
    "",
  );
  const [captionError, setCaptionError] = useState("");

  return (
    <form className="mt-3 flex flex-col gap-2" action={updateAction}>
      <input type="hidden" name="image_id" value={image.id} />
      <label className="label" htmlFor={`caption-${image.id}`}>
        Caption
      </label>
      <p className="text-sm text-red-600">{captionError || stateMessage}</p>
      <input
        id={`caption-${image.id}`}
        name="caption"
        defaultValue={image.caption ?? ""}
        maxLength={250}
        onChange={(event) =>
          setCaptionError(
            event.target.value.length > 250
              ? "Caption must be 250 characters or fewer."
              : "",
          )
        }
        className="field"
      />
      <button
        type="submit"
        disabled={pending || Boolean(captionError)}
        aria-disabled={pending || Boolean(captionError)}
        className="w-max rounded-lg border border-black/10 p-2 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save caption"}
      </button>
    </form>
  );
}

function ActionButton({ imageId, action, children, fields = {} }) {
  const [stateMessage, formAction, pending] = useActionState(action, "");

  return (
    <form action={formAction}>
      <input type="hidden" name="image_id" value={imageId} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        title={stateMessage || undefined}
        className="rounded-lg border border-black/10 p-2 px-3 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "..." : children}
      </button>
    </form>
  );
}

export function PortfolioPageUI({
  images,
  uploadPortfolioImage,
  updatePortfolioImageCaption,
  movePortfolioImage,
  setPortfolioImageVisibility,
  deletePortfolioImage,
}) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Portfolio</h1>

        <UploadForm uploadPortfolioImage={uploadPortfolioImage} />

        <div className="mt-10 flex flex-col gap-5">
          {images.length === 0 ? (
            <div className="flex h-40 rounded-xl border p-4">
              <p className="m-auto text-center text-sm text-black/60">
                No portfolio images yet.
              </p>
            </div>
          ) : null}

          {images.map((image, index) => (
            <section key={image.id} className="rounded-xl border p-3">
              <div
                className="h-56 rounded-lg bg-black/5 bg-cover bg-center"
                style={
                  image.signed_url
                    ? { backgroundImage: `url("${image.signed_url}")` }
                    : undefined
                }
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {image.is_visible ? "Visible" : "Hidden"}
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <ActionButton
                    imageId={image.id}
                    action={movePortfolioImage}
                    fields={{ direction: "up" }}
                  >
                    Up
                  </ActionButton>
                  <ActionButton
                    imageId={image.id}
                    action={movePortfolioImage}
                    fields={{ direction: "down" }}
                  >
                    Down
                  </ActionButton>
                  <ActionButton
                    imageId={image.id}
                    action={setPortfolioImageVisibility}
                    fields={{ is_visible: image.is_visible ? "false" : "true" }}
                  >
                    {image.is_visible ? "Hide" : "Show"}
                  </ActionButton>
                  <ActionButton imageId={image.id} action={deletePortfolioImage}>
                    Delete
                  </ActionButton>
                </div>
              </div>
              <p className="mt-2 text-xs text-black/50">
                Display position {index + 1}
              </p>
              <CaptionForm
                image={image}
                updatePortfolioImageCaption={updatePortfolioImageCaption}
              />
            </section>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Link
            href="/provider/page"
            className="w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
          >
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
