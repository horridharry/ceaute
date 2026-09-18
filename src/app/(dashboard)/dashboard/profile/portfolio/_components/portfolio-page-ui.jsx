"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { StackedTopBar } from "@/components/ui/top-bar";

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
    <form className="flex flex-col gap-[13px]" action={uploadAction}>
      <span className="field-set">
        <label className="label" htmlFor="image">
          Image
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={validateFile}
          aria-invalid={fileError ? true : undefined}
          className="field cursor-pointer"
        />
        {fileError ? (
          <p role="alert" className="text-[11.5px] text-bad">
            {fileError}
          </p>
        ) : null}
      </span>

      <span className="field-set">
        <label className="label" htmlFor="caption">
          Caption <span className="font-normal text-black/45">— optional</span>
        </label>
        <input
          id="caption"
          name="caption"
          maxLength={250}
          onChange={validateCaption}
          aria-invalid={captionError ? true : undefined}
          className="field"
        />
        {captionError || stateMessage ? (
          <p role="alert" className="text-[11.5px] text-bad">
            {captionError || stateMessage}
          </p>
        ) : null}
      </span>

      <Button
        type="submit"
        disabled={pending || hasError}
        aria-disabled={pending || hasError}
      >
        {pending ? "Uploading…" : "Add a photo"}
      </Button>
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
    <form className="mt-3 flex flex-col gap-1.5" action={updateAction}>
      <input type="hidden" name="image_id" value={image.id} />
      <label className="label" htmlFor={`caption-${image.id}`}>
        Caption
      </label>
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
        aria-invalid={captionError ? true : undefined}
        className="field"
      />
      {captionError || stateMessage ? (
        <p role="alert" className="text-[11.5px] text-bad">
          {captionError || stateMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || Boolean(captionError)}
        aria-disabled={pending || Boolean(captionError)}
        className="w-max text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save caption"}
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
        className="rounded-full border border-black/14 px-3 py-1.5 text-[12.5px] font-medium text-ink transition duration-150 ease-out hover:border-black/30 disabled:opacity-40"
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
    <>
      <div className="mx-auto w-full max-w-[720px] px-5">
        <StackedTopBar backHref="/dashboard/profile" backLabel="Your page" />
      </div>
      <main className="mx-auto w-full max-w-[720px] px-5 pb-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-display text-pretty text-ink">Portfolio</h1>
            <p className="text-meta text-black/50">
              The first photo is the hero on your page. Caption or hide any of
              them.
            </p>
          </div>

        <UploadForm uploadPortfolioImage={uploadPortfolioImage} />

        <div className="mt-4 flex flex-col gap-4">
          {images.length === 0 ? (
            <p className="text-[13px] text-black/60">
              No photos yet. Your page needs at least one before it can publish.
            </p>
          ) : null}

          {images.map((image, index) => (
            <section
              key={image.id}
              className="relative rounded-card border border-black/12 p-3"
            >
              {index === 0 ? (
                <span className="absolute left-5 top-5 z-10 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-white">
                  Hero
                </span>
              ) : null}
              <div
                className="h-56 rounded-row bg-surface bg-cover bg-center"
                style={
                  image.signed_url
                    ? { backgroundImage: `url("${image.signed_url}")` }
                    : undefined
                }
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                  <span
                    aria-hidden="true"
                    className={`block size-[7px] shrink-0 rounded-full ${image.is_visible ? "bg-ok" : "bg-black/30"}`}
                  />
                  <span className={image.is_visible ? "text-ok" : "text-black/60"}>
                    {image.is_visible ? "On your page" : "Hidden"}
                  </span>
                </span>
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

        </div>
      </main>
    </>
  );
}
