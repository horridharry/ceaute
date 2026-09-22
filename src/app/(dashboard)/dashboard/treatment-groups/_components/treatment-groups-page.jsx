"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkFilterPills } from "@/components/ui/filter-pills";
import { DashboardPage } from "../../_components/dashboard-page";
import { ManagementRow } from "../../_components/management-row";
import { blockedGroupMessage } from "../../_lib/lifecycle-outcome";
import {
  groupTreatmentsLine,
  lifecycleFilterOptions,
  splitByState,
} from "../../_lib/lifecycle-lists";
import { useServerAction } from "../../_lib/use-server-action";

const CONFIRM = {
  archive: {
    description: "It won’t appear on your page. You can restore it from Archived.",
    cancelLabel: "Keep active",
    confirmLabel: "Archive",
    pendingLabel: "Archiving…",
    tone: "primary",
  },
  delete: {
    description: "This can’t be undone. Your treatments and past bookings are not affected.",
    cancelLabel: "Keep group",
    confirmLabel: "Delete group",
    pendingLabel: "Deleting…",
    tone: "destructive",
  },
};

// A group can't be archived or deleted while any treatment, active or
// archived, is filed under it. PostgreSQL enforces that
// (transition_treatment_group); this screen explains it before asking, and
// again if the database refuses. Nothing moves treatments automatically.
function BlockedTreatmentList({ treatments }) {
  return (
    <ul className="mt-3 flex flex-col">
      {treatments.map((treatment) => (
        <li key={treatment.id} className="border-b border-line last:border-b-0">
          <Link
            href={`/dashboard/treatments/${treatment.id}/edit`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span className="flex flex-wrap items-center gap-2">
              {treatment.name}
              {treatment.is_active ? null : <Badge tone="quiet">Archived</Badge>}
            </span>
            <span className="font-semibold text-accent">
              Edit<span className="sr-only"> {treatment.name}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TreatmentGroupsPage({ groups, status, transitionAction }) {
  const [runTransition, pending] = useServerAction(transitionAction);
  const [outcome, setOutcome] = useState(null);
  const [confirming, setConfirming] = useState(null); // { group, transition }
  const [blocked, setBlocked] = useState(null); // { group, transition, treatments }
  const [confirmError, setConfirmError] = useState("");
  const statusRef = useRef(null);
  const { active, archived } = splitByState(groups);
  const shown = status === "archived" ? archived : active;

  const perform = async (group, transition) => {
    const result = await runTransition({ groupId: group.id, groupName: group.name, transition });

    if (result.status === "blocked") {
      setConfirming(null);
      setBlocked({ group, transition, treatments: result.treatments });
      return;
    }

    if (result.status === "done") {
      setConfirming(null);
      setConfirmError("");
      setOutcome(result);
      statusRef.current?.focus();
      return;
    }

    if (confirming) {
      setConfirmError(result.message);
    } else {
      setOutcome(result);
      statusRef.current?.focus();
    }
  };

  // Archive and delete are confirmed; a group that still has treatments gets
  // the explanation instead of the question.
  const ask = (group, transition) => {
    setConfirmError("");
    if (group.treatments.length > 0) {
      setBlocked({ group, transition, treatments: group.treatments });
    } else {
      setConfirming({ group, transition });
    }
  };

  const menuItems = (group) =>
    group.is_active
      ? [
          { key: "rename", label: "Rename", href: `/dashboard/treatment-groups/${group.id}/edit` },
          { key: "archive", label: "Archive…", onSelect: () => ask(group, "archive") },
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
          { key: "restore", label: "Restore", onSelect: () => perform(group, "restore") },
          {
            key: "delete",
            label: "Delete…",
            tone: "danger",
            separatorBefore: true,
            onSelect: () => ask(group, "delete"),
          },
        ];

  const blockedText = blocked
    ? blockedGroupMessage({
        transition: blocked.transition,
        name: blocked.group.name,
        treatments: blocked.treatments,
      })
    : null;
  const confirmText = confirming ? CONFIRM[confirming.transition] : null;

  return (
    <DashboardPage
      title="Treatment groups"
      description="Groups organise your treatments on your page."
      newHref="/dashboard/treatment-groups/new"
    >
      <LinkFilterPills
        label="Filter treatment groups"
        value={status}
        options={lifecycleFilterOptions({
          basePath: "/dashboard/treatment-groups",
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
        <EmptyState className="mt-2">
          {status === "archived"
            ? "No archived groups."
            : groups.length === 0
              ? "No treatment groups yet."
              : "No active groups. Restore one from Archived or add a new one."}
        </EmptyState>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {shown.map((group) => (
            <ManagementRow
              key={group.id}
              href={`/dashboard/treatment-groups/${group.id}/edit`}
              name={group.name}
              archived={!group.is_active}
              meta={[groupTreatmentsLine(group.treatments)]}
              menu={<ActionMenu label={`Actions for ${group.name}`} items={menuItems(group)} />}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming ? `${confirming.transition === "delete" ? "Delete" : "Archive"} ${confirming.group.name}?` : ""}
        description={confirmText?.description}
        cancelLabel={confirmText?.cancelLabel}
        confirmLabel={confirmText?.confirmLabel}
        pendingLabel={confirmText?.pendingLabel}
        tone={confirmText?.tone}
        pending={pending}
        error={confirmError}
        onConfirm={() => perform(confirming.group, confirming.transition)}
        onCancel={() => setConfirming(null)}
        fallbackFocusRef={statusRef}
      />

      <ConfirmDialog
        open={Boolean(blocked)}
        blocked
        title={blockedText?.title ?? ""}
        description={blockedText?.body}
        onCancel={() => setBlocked(null)}
        fallbackFocusRef={statusRef}
      >
        {blocked ? <BlockedTreatmentList treatments={blocked.treatments} /> : null}
      </ConfirmDialog>
    </DashboardPage>
  );
}
