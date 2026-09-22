"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { buttonClassName } from "@/components/ui/button-classes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PhotoViewer } from "@/features/photo-viewing/photo-viewer";
import { DashboardPage } from "../../../_components/dashboard-page";
import { useServerAction } from "../../../_lib/use-server-action";
import { LAST_VISIBLE_PHOTO_MESSAGE } from "../_lib/portfolio-messages";
import {
  ALLOWED_IMAGE_TYPES,
  PREVIEW_COUNT,
  describeFileProblem,
  isLastVisiblePhoto,
} from "../_lib/portfolio-rules";

const pluralise = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function Photo({ image, label, onOpen, dimmed = false }) {
  return (
    <button
      type="button"
      data-portfolio-image-id={image.id}
      aria-label={label}
      onClick={onOpen}
      className={`block aspect-[4/5] w-full rounded-md bg-surface-subtle bg-cover bg-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        dimmed ? "opacity-55 grayscale-[60%]" : ""
      }`}
      style={image.signed_url ? { backgroundImage: `url("${image.signed_url}")` } : undefined}
    />
  );
}

// Viewing is the customer's view: the first photos, then all of them, each
// opening in the shared viewer. Managing is a separate mode.
export function PortfolioManager({ images, isLive, actions }) {
  const [editing, setEditing] = useState(images.length === 0);
  const [showAll, setShowAll] = useState(false);
  const [viewing, setViewing] = useState(null); // { list, index }
  const [outcome, setOutcome] = useState(null);
  const [uploads, setUploads] = useState([]); // { key, name, state, message }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [blocked, setBlocked] = useState(null); // "delete" | "hide"
  const [captioning, setCaptioning] = useState(null);
  const [captionText, setCaptionText] = useState("");
  const [dialogError, setDialogError] = useState("");
  const statusRef = useRef(null);
  const fileRef = useRef(null);
  const [upload] = useServerAction(actions.upload);
  const [move, moving] = useServerAction(actions.move);
  const [setVisibility] = useServerAction(actions.visibility);
  const [saveCaption, captionPending] = useServerAction(actions.caption);
  const [remove, removing] = useServerAction(actions.remove);

  const visible = images.filter((image) => image.is_visible);
  const hiddenCount = images.length - visible.length;
  const preview = showAll ? visible : visible.slice(0, PREVIEW_COUNT);

  const report = (result) => {
    setOutcome(result);
    statusRef.current?.focus();
  };

  const addFiles = async (fileList) => {
    const files = [...fileList];
    if (fileRef.current) fileRef.current.value = "";
    const entries = files.map((file, index) => ({
      key: `${Date.now()}-${index}`,
      name: file.name,
      file,
      state: describeFileProblem(file) ? "error" : "waiting",
      message: describeFileProblem(file),
    }));
    setUploads((current) => [...entries, ...current]);

    // One after another, so each photo lands at the end in the order chosen.
    for (const entry of entries.filter((candidate) => candidate.state === "waiting")) {
      setUploads((current) => current.map((item) => (item.key === entry.key ? { ...item, state: "uploading" } : item)));
      const result = await upload({ image: entry.file, caption: "" });
      setUploads((current) =>
        result.status === "done"
          ? current.filter((item) => item.key !== entry.key)
          : current.map((item) =>
              item.key === entry.key
                ? { ...item, state: "error", message: `Couldn’t add ${entry.name}. ${result.message}` }
                : item,
            ),
      );
    }
    const added = entries.filter((entry) => entry.state === "waiting").length;
    if (added) report({ status: "done", message: `${pluralise(added, "photo")} added.` });
  };

  const askDelete = (image) => {
    setDialogError("");
    if (isLive && isLastVisiblePhoto(images, image)) setBlocked("delete");
    else setConfirmDelete(image);
  };

  const toggleVisibility = async (image) => {
    if (image.is_visible && isLive && isLastVisiblePhoto(images, image)) {
      setBlocked("hide");
      return;
    }
    const result = await setVisibility({ image_id: image.id, is_visible: String(!image.is_visible) });
    report(
      result.status === "done" && image.is_visible && isLastVisiblePhoto(images, image)
        ? { status: "done", message: "Photo hidden. Your page needs at least one visible photo before you can publish." }
        : result,
    );
  };

  const menuItems = (image, index) => [
    {
      key: "earlier",
      label: "Move earlier",
      disabled: index === 0 || moving,
      reason: index === 0 ? "Already first" : "",
      onSelect: async () => report(await move({ image_id: image.id, direction: "up" })),
    },
    {
      key: "later",
      label: "Move later",
      disabled: index === images.length - 1 || moving,
      reason: index === images.length - 1 ? "Already last" : "",
      onSelect: async () => report(await move({ image_id: image.id, direction: "down" })),
    },
    {
      key: "visibility",
      label: image.is_visible ? "Hide from page" : "Show on page",
      onSelect: () => toggleVisibility(image),
    },
    {
      key: "caption",
      label: "Edit caption",
      onSelect: () => {
        setDialogError("");
        setCaptionText(image.caption ?? "");
        setCaptioning(image);
      },
    },
    { key: "delete", label: "Delete…", tone: "danger", separatorBefore: true, onSelect: () => askDelete(image) },
  ];

  const viewer = (list, index) => setViewing({ list, index });
  const viewerPhotos = (viewing?.list ?? [])
    .filter((image) => image.signed_url)
    .map((image) => ({ id: image.id, image_url: image.signed_url, caption: image.caption ?? "" }));

  return (
    <DashboardPage
      title="Portfolio"
      description="Photos of your work. The first photos lead your page."
      width={editing ? "medium" : "narrow"}
      action={
        images.length ? (
          <Button
            type="button"
            size="compact"
            variant={editing ? "primary" : "secondary"}
            onClick={() => {
              setEditing(!editing);
              setOutcome(null);
            }}
          >
            {editing ? "Done" : "Edit photos"}
          </Button>
        ) : null
      }
    >
      <p
        ref={statusRef}
        tabIndex={-1}
        role={outcome?.status === "error" ? "alert" : "status"}
        className={`mt-4 text-sm outline-none ${outcome?.status === "error" ? "text-danger" : "text-ink-muted"}`}
      >
        {outcome?.message ?? ""}
      </p>

      {!editing ? (
        <>
          {visible.length ? (
            <ul className="mt-2 grid grid-cols-3 gap-1">
              {preview.map((image, index) => (
                <li key={image.id}>
                  <Photo
                    image={image}
                    label={`${image.caption || `Photo ${index + 1}`}, ${index + 1} of ${visible.length}, open`}
                    onOpen={() => viewer(visible, index)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-2">No visible photos.</EmptyState>
          )}
          {visible.length > PREVIEW_COUNT ? (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
              className={buttonClassName({ variant: "outline", className: "mt-3 w-full" })}
            >
              {showAll ? "Show fewer" : `View all ${pluralise(visible.length, "photo")}`}
            </button>
          ) : null}
          {hiddenCount ? (
            <p className="mt-3 text-sm text-ink-muted">
              {pluralise(hiddenCount, "hidden photo")}. Only you can see {hiddenCount === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </>
      ) : (
        <>
          {images.length === 0 ? (
            <EmptyState variant="bounded" className="mt-2">
              No photos yet. Add photos of your work so customers can see your style.
            </EmptyState>
          ) : null}
          <ul className="mt-3 grid grid-cols-3 gap-1">
            <li>
              <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-md border-[1.5px] border-dashed border-line-strong p-2 text-center text-[13px] text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus hover:bg-surface-subtle">
                <span>
                  <span aria-hidden="true" className="block text-xl leading-none">+</span>
                  Add photos
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  className="sr-only"
                  onChange={(event) => event.target.files?.length && addFiles(event.target.files)}
                />
              </label>
            </li>
            {uploads.map((item) => (
              <li
                key={item.key}
                className={`flex aspect-[4/5] flex-col justify-center gap-2 rounded-md p-2 text-xs ${
                  item.state === "error" ? "border border-danger-line text-danger" : "bg-surface-subtle text-ink-muted"
                }`}
              >
                {item.state === "error" ? (
                  <>
                    <span role="alert">{item.message}</span>
                    <button
                      type="button"
                      className="self-start font-semibold text-accent"
                      onClick={() => setUploads((current) => current.filter((upload) => upload.key !== item.key))}
                    >
                      Remove<span className="sr-only"> {item.name}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="truncate">{item.name}</span>
                    <span className="h-1 overflow-hidden rounded bg-line" aria-hidden="true">
                      <span className="block h-full w-1/2 bg-action motion-safe:animate-pulse" />
                    </span>
                    <span className="sr-only" role="status">Adding {item.name}</span>
                  </>
                )}
              </li>
            ))}
            {images.map((image, index) => (
              <li key={image.id} className="relative">
                <Photo
                  image={image}
                  dimmed={!image.is_visible}
                  label={`${image.caption || `Photo ${index + 1}`}, ${index + 1} of ${images.length}${image.is_visible ? "" : ", hidden"}, open`}
                  onOpen={() => viewer(images, index)}
                />
                {image.is_visible ? null : (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Hidden
                  </span>
                )}
                <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                  {index + 1}
                </span>
                {/* The first column opens its menu rightwards, the others
                    leftwards, so it never runs off a narrow screen. The
                    upload tile and any uploads in progress come first. */}
                <div className="absolute bottom-1 right-1 rounded-lg bg-white/90 shadow-sm">
                  <ActionMenu
                    label={`Actions for photo ${index + 1}`}
                    align={(uploads.length + index + 1) % 3 === 0 ? "left" : "right"}
                    items={menuItems(image, index)}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-ink-muted">
            {pluralise(images.length, "photo")} · {visible.length} visible
          </p>
        </>
      )}

      <PhotoViewer
        photos={viewerPhotos}
        index={viewing?.index ?? null}
        label="Your portfolio"
        onIndexChange={(index) => setViewing((current) => ({ ...current, index }))}
        onClose={() => setViewing(null)}
        onClosed={(closedIndex) => {
          const photo = viewerPhotos[closedIndex];
          if (photo) document.querySelector(`[data-portfolio-image-id="${CSS.escape(photo.id)}"]`)?.focus();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this photo?"
        description="It’s removed from your page and can’t be restored."
        cancelLabel="Keep photo"
        confirmLabel="Delete photo"
        pendingLabel="Deleting…"
        pending={removing}
        error={dialogError}
        onConfirm={async () => {
          const result = await remove({ image_id: confirmDelete.id });
          if (result.status === "done") {
            setConfirmDelete(null);
            report(result);
          } else {
            setDialogError(result.message);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        fallbackFocusRef={statusRef}
      >
        {confirmDelete && isLastVisiblePhoto(images, confirmDelete) ? (
          <p className="mt-2 text-sm">
            This is your only visible photo. Your page needs at least one before you can publish.
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(blocked)}
        blocked
        title={blocked === "hide" ? "This photo can’t be hidden" : "This photo can’t be deleted"}
        description={LAST_VISIBLE_PHOTO_MESSAGE}
        onCancel={() => setBlocked(null)}
        fallbackFocusRef={statusRef}
      >
        <p className="mt-3">
          <Link href="/dashboard/settings/publication" className={buttonClassName({ variant: "secondary", size: "compact" })}>
            Go to Publication
          </Link>
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(captioning)}
        title="Edit caption"
        cancelLabel="Cancel"
        confirmLabel="Save caption"
        pendingLabel="Saving…"
        tone="primary"
        pending={captionPending}
        error={dialogError}
        onConfirm={async () => {
          const result = await saveCaption({ image_id: captioning.id, caption: captionText });
          if (result.status === "done") {
            setCaptioning(null);
            report(result);
          } else {
            setDialogError(result.message);
          }
        }}
        onCancel={() => setCaptioning(null)}
        fallbackFocusRef={statusRef}
      >
        <label htmlFor="portfolio-caption" className="label mt-3">
          Caption <span className="text-ink-muted">(optional)</span>
        </label>
        <Input
          id="portfolio-caption"
          className="mt-1.5 w-full"
          maxLength={250}
          value={captionText}
          onChange={(event) => setCaptionText(event.target.value)}
        />
      </ConfirmDialog>
    </DashboardPage>
  );
}
