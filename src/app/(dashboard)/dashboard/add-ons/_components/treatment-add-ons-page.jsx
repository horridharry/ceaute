"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { buttonClassName } from "@/components/ui/button-classes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkFilterPills } from "@/components/ui/filter-pills";
import { DashboardPage } from "../../_components/dashboard-page";
import { ManagementRow } from "../../_components/management-row";
import { formatPrice } from "../../_lib/price-duration";
import { lifecycleFilterOptions, splitByState, worksWithLine } from "../../_lib/lifecycle-lists";
import { useServerAction } from "../../_lib/use-server-action";

const CONFIRM = {
  archive: {
    description: "Customers can’t add it to new bookings. You can restore it from Archived.",
    cancelLabel: "Keep active",
    confirmLabel: "Archive",
    pendingLabel: "Archiving…",
    tone: "primary",
  },
  delete: {
    description: "This can’t be undone. It’s removed from your add-ons for good. Past bookings keep their details.",
    cancelLabel: "Keep add-on",
    confirmLabel: "Delete add-on",
    pendingLabel: "Deleting…",
    tone: "destructive",
  },
};

function addOnPriceLine(addOn) {
  const parts = [];
  if (addOn.additional_price_pence > 0) parts.push(`+${formatPrice(addOn.additional_price_pence)}`);
  if (addOn.additional_duration_minutes > 0) parts.push(`+${addOn.additional_duration_minutes} min`);
  return parts.join(" · ");
}

// Active and Archived are filters; deleted add-ons appear in neither. Archive,
// restore and delete run through transition_treatment_add_on, which refuses
// to delete an active add-on, so Delete is offered only from Archived.
export function TreatmentAddOnsPage({ addOns, status, transitionAction }) {
  const [runTransition, pending] = useServerAction(transitionAction);
  const [outcome, setOutcome] = useState(null);
  const [confirming, setConfirming] = useState(null); // { addOn, transition }
  const [confirmError, setConfirmError] = useState("");
  const statusRef = useRef(null);
  // After the render that closes any dialog: focus inside an open modal
  // fails, and the row that opened it may be about to leave the list.
  useEffect(() => {
    if (outcome) statusRef.current?.focus();
  }, [outcome]);
  const { active, archived } = splitByState(addOns);
  const shown = status === "archived" ? archived : active;

  const perform = async (addOn, transition, fromDialog) => {
    const result = await runTransition({ addOnId: addOn.addOnId, addOnName: addOn.name, transition });

    if (fromDialog && result.status !== "done") {
      setConfirmError(result.message);
      return;
    }

    setConfirming(null);
    setConfirmError("");
    setOutcome(result);
  };

  const ask = (addOn, transition) => {
    setConfirmError("");
    setConfirming({ addOn, transition });
  };

  const menuItems = (addOn) =>
    addOn.is_active
      ? [
          { key: "edit", label: "Edit", href: `/dashboard/add-ons/${addOn.addOnId}/edit` },
          { key: "archive", label: "Archive…", onSelect: () => ask(addOn, "archive") },
          {
            key: "delete",
            label: "Delete",
            tone: "danger",
            separatorBefore: true,
            disabled: true,
            reason: "Archive first to delete",
          },
        ]
      : [
          { key: "restore", label: "Restore", onSelect: () => perform(addOn, "restore", false) },
          {
            key: "delete",
            label: "Delete…",
            tone: "danger",
            separatorBefore: true,
            onSelect: () => ask(addOn, "delete"),
          },
        ];

  const confirmText = confirming ? CONFIRM[confirming.transition] : null;

  return (
    <DashboardPage
      title="Add-ons"
      description="Extras customers can add to a treatment."
      newHref="/dashboard/add-ons/new"
    >
      <LinkFilterPills
        label="Filter add-ons"
        value={status}
        options={lifecycleFilterOptions({
          basePath: "/dashboard/add-ons",
          active: active.length,
          archived: archived.length,
        })}
        className="mt-6"
      />

      <p
        ref={statusRef}
        tabIndex={-1}
        role={outcome?.status === "error" ? "alert" : "status"}
        className={`mt-4 text-sm outline-none ${outcome?.status === "error" ? "text-danger" : "text-ink-muted"}`}
      >
        {outcome?.message ?? ""}
      </p>

      {shown.length === 0 ? (
        status === "archived" ? (
          <EmptyState className="mt-2">No archived add-ons.</EmptyState>
        ) : addOns.length === 0 ? (
          <EmptyState
            variant="bounded"
            className="mt-2"
            action={
              <Link
                href="/dashboard/add-ons/new"
                className={buttonClassName({ variant: "secondary", size: "compact" })}
              >
                Add an add-on
              </Link>
            }
          >
            No add-ons yet. Add-ons let customers extend a treatment.
          </EmptyState>
        ) : (
          <EmptyState className="mt-2">
            No active add-ons. Restore one from Archived or add a new one.
          </EmptyState>
        )
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {shown.map((addOn) => (
            <ManagementRow
              key={addOn.addOnId}
              href={`/dashboard/add-ons/${addOn.addOnId}/edit`}
              name={addOn.name}
              archived={!addOn.is_active}
              meta={[addOnPriceLine(addOn), worksWithLine(addOn.compatible_treatment_count)]}
              menu={<ActionMenu label={`Actions for ${addOn.name}`} items={menuItems(addOn)} />}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming ? `${confirming.transition === "delete" ? "Delete" : "Archive"} ${confirming.addOn.name}?` : ""}
        description={confirmText?.description}
        cancelLabel={confirmText?.cancelLabel}
        confirmLabel={confirmText?.confirmLabel}
        pendingLabel={confirmText?.pendingLabel}
        tone={confirmText?.tone}
        pending={pending}
        error={confirmError}
        onConfirm={() => perform(confirming.addOn, confirming.transition, true)}
        onCancel={() => setConfirming(null)}
        fallbackFocusRef={statusRef}
      />
    </DashboardPage>
  );
}
