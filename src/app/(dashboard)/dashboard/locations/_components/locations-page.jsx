"use client";

import { useEffect, useRef, useState } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPage } from "../../_components/dashboard-page";
import { ManagementRow } from "../../_components/management-row";
import { useServerAction } from "../../_lib/use-server-action";

function describeAddress(location) {
  return [location.address_line_1, location.address_line_2, location.city, location.postcode]
    .filter(Boolean)
    .join(", ");
}

// Every card is white; the primary location is first and carries a compact
// "Primary" badge. Which location is primary, and whether one can be deleted,
// is decided by PostgreSQL (set_primary_provider_location and the
// protect_primary_provider_location trigger).
export function LocationsPage({ locations, makePrimaryAction, deleteAction }) {
  const [outcome, setOutcome] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [makePrimary] = useServerAction(makePrimaryAction);
  const [removeLocation, deletePending] = useServerAction(deleteAction);
  const statusRef = useRef(null);
  // After the render that closes any dialog: focus inside an open modal
  // fails, and the row that opened it may be about to leave the list.
  useEffect(() => {
    if (outcome) statusRef.current?.focus();
  }, [outcome]);

  const report = (result) => {
    setOutcome(result);
  };

  const confirmDelete = async () => {
    const result = await removeLocation({ location_id: deleting.id });
    if (result.status === "done") {
      setDeleting(null);
      setDeleteError("");
      setOutcome(result);
    } else {
      setDeleteError(result.message);
    }
  };

  const nameOf = (location) => location.public_area || "No public area yet";

  return (
    <DashboardPage
      title="Locations"
      description="Customers see the area until they book."
      newHref="/dashboard/locations/new"
    >
      <p
        ref={statusRef}
        tabIndex={-1}
        role={outcome?.status === "error" ? "alert" : "status"}
        className={`mt-4 text-sm outline-none ${outcome?.status === "error" ? "text-danger" : "text-ink-muted"}`}
      >
        {outcome?.message ?? ""}
      </p>

      {locations.length === 0 ? (
        <EmptyState variant="bounded" className="mt-4">
          You have not saved a location yet. Add one so customers can find you and book.
        </EmptyState>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {locations.map((location) => (
            <ManagementRow
              key={location.id}
              href={`/dashboard/locations/${location.id}/edit`}
              name={nameOf(location)}
              badge={location.is_primary ? <Badge tone="neutral">Primary</Badge> : null}
              meta={[describeAddress(location) || "No address yet"]}
              menu={
                <ActionMenu
                  label={`Actions for ${nameOf(location)}`}
                  items={[
                    { key: "edit", label: "Edit", href: `/dashboard/locations/${location.id}/edit` },
                    ...(location.is_primary
                      ? []
                      : [
                          {
                            key: "primary",
                            label: "Make primary",
                            onSelect: async () =>
                              report(await makePrimary({ location_id: location.id })),
                          },
                        ]),
                    {
                      key: "delete",
                      label: location.is_primary ? "Delete" : "Delete…",
                      tone: "danger",
                      separatorBefore: true,
                      disabled: location.is_primary,
                      reason: location.is_primary ? "Make another location primary first" : "",
                      onSelect: () => {
                        setDeleteError("");
                        setDeleting(location);
                      },
                    },
                  ]}
                />
              }
            />
          ))}
        </ul>
      )}

      {locations.length === 1 ? (
        <p className="mt-4 text-sm text-ink-muted">
          Add another location before replacing this one.
        </p>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting ? nameOf(deleting) : "this location"}?`}
        description="The saved address is removed. Confirmed bookings keep the address they were booked at."
        cancelLabel="Keep location"
        confirmLabel="Delete location"
        pendingLabel="Deleting…"
        pending={deletePending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        fallbackFocusRef={statusRef}
      />
    </DashboardPage>
  );
}
