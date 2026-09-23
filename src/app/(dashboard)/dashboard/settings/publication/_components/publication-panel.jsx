"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonClassName } from "@/components/ui/button-classes";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useServerAction } from "../../../_lib/use-server-action";

function StatusDot({ live }) {
  return <span aria-hidden="true" className={`h-2 w-2 rounded-full ${live ? "bg-green-700" : "bg-ink-subtle"}`} />;
}

// Whether customers can see the page. Publishing is always a deliberate
// action; Ceaute never publishes or unpublishes a page by itself.
export function PublicationPanel({ status, username, readiness, publishPage, unpublishPage }) {
  const [runPublish, publishing] = useServerAction(publishPage);
  const [runUnpublish, unpublishing] = useServerAction(unpublishPage);
  const [outcome, setOutcome] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const statusRef = useRef(null);
  const live = status === "published";
  const pageUrl = username ? `/@${username}` : "";

  const report = (result) => {
    setOutcome(result);
    statusRef.current?.focus();
  };

  return (
    <>
      <p
        ref={statusRef}
        tabIndex={-1}
        role={outcome?.error ? "alert" : "status"}
        className={`mt-4 text-sm outline-none ${outcome?.error ? "text-danger" : "text-ink-muted"}`}
      >
        {outcome?.message ?? ""}
      </p>

      <Card as="section" aria-label="Page status" className="mt-2 flex flex-col gap-3 text-sm">
        <p className="flex items-center gap-2 text-base font-semibold">
          <StatusDot live={live} />
          {live ? "Live" : status === "suspended" ? "Suspended" : "Not live"}
        </p>

        {status === "suspended" ? (
          <p className="text-ink-muted">Suspended pages cannot be published. Contact Ceaute for help.</p>
        ) : live ? (
          <>
            {pageUrl ? (
              <Link href={pageUrl} className="font-semibold text-accent">
                ceaute.com{pageUrl}
              </Link>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {pageUrl ? (
                <Link href={pageUrl} className={buttonClassName({ variant: "secondary" })}>
                  View page
                </Link>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDialogError("");
                  setConfirming(true);
                }}
              >
                Unpublish page
              </Button>
            </div>
          </>
        ) : (
          <>
            {readiness.ready ? (
              <p className="text-ink-muted">Everything’s in place. Publishing makes your page visible and bookable.</p>
            ) : (
              <>
                <p className="text-ink-muted">Before you publish:</p>
                <ul>
                  {readiness.requirements
                    .filter((requirement) => !requirement.met)
                    .map((requirement) => (
                      <li key={requirement.label} className="border-b border-line last:border-b-0">
                        <Link
                          href={requirement.href}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          {requirement.label}
                          <span className="shrink-0 text-[13px] font-semibold text-accent">
                            Set up<span className="sr-only"> {requirement.label}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={!readiness.ready || publishing}
                aria-busy={publishing || undefined}
                aria-describedby={readiness.ready ? undefined : "publish-unavailable"}
                onClick={async () => report(await runPublish({}))}
              >
                {publishing ? "Publishing…" : "Publish page"}
              </Button>
              <Link href="/dashboard/profile/preview" className={buttonClassName({ variant: "secondary" })}>
                Preview your page
              </Link>
            </div>
            {readiness.ready ? null : (
              <p id="publish-unavailable" className="text-[13px] text-ink-muted">
                Publishing becomes available when everything above is done.
              </p>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Unpublish your page?"
        description="Customers won’t be able to find or book you. Existing bookings are not affected."
        cancelLabel="Keep page live"
        confirmLabel="Unpublish"
        pendingLabel="Unpublishing…"
        pending={unpublishing}
        error={dialogError}
        onConfirm={async () => {
          const result = await runUnpublish({});
          if (result.error) {
            setDialogError(result.message);
          } else {
            setConfirming(false);
            report(result);
          }
        }}
        onCancel={() => setConfirming(false)}
        fallbackFocusRef={statusRef}
      />
    </>
  );
}
