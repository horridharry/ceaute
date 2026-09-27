"use client";

// The Availability screen: the provider's drops, and at most one drop editor
// open at a time. Drops come from the server on every render, so a save
// shows through the refreshed props rather than any copy kept here.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormStatus } from "@/components/ui/form-feedback";
import { Notice } from "@/components/ui/notice";
import { DashboardPage } from "../_components/dashboard-page";
import { DropEditor } from "./_components/drop-editor";
import { DropList } from "./_components/drop-list";
import { toBookingCountsByDate } from "./_lib/booking-messages";

const NEW_DROP = "new";

export function AvailabilityForm({
  drops,
  bookingCountRows,
  isPublished,
  today,
  now,
  saveDrop,
}) {
  // null, NEW_DROP, or the id of the drop being edited.
  const [editing, setEditing] = useState(null);
  const [saved, setSaved] = useState(false);
  // Where focus goes once an editor closes: its drop's Edit, or Add dates.
  const returnFocusRef = useRef(null);
  const countsByDate = useMemo(
    () => toBookingCountsByDate(bookingCountRows),
    [bookingCountRows],
  );

  useEffect(() => {
    if (editing !== null || returnFocusRef.current === null) return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    const byId = target === NEW_DROP ? null : document.getElementById(`edit-${target}`);
    (byId ?? document.getElementById("add-dates"))?.focus();
  }, [editing]);

  const openEditor = (target) => {
    setSaved(false);
    setEditing(target);
  };

  const closeEditor = () => {
    returnFocusRef.current = editing;
    setEditing(null);
  };

  const handleSaved = () => {
    setSaved(true);
    closeEditor();
  };

  const editor =
    editing === null ? null : (
      <DropEditor
        key={editing}
        drop={drops.find((drop) => drop.id === editing) ?? null}
        drops={drops}
        countsByDate={countsByDate}
        today={today}
        now={now}
        saveDrop={saveDrop}
        onSaved={handleSaved}
        onCancel={closeEditor}
      />
    );

  const addDatesButton = (
    <Button
      id="add-dates"
      type="button"
      variant="secondary"
      className="min-h-11 self-start"
      onClick={() => openEditor(NEW_DROP)}
    >
      Add dates
    </Button>
  );

  return (
    <DashboardPage
      title="Availability"
      description="Pick dates, give them times and choose when they open for booking."
    >
      <div className="mt-6 flex flex-col gap-6">
        {isPublished && drops.length === 0 ? (
          <Notice tone="neutral" role={null}>
            Customers can&apos;t book: you have no open dates.
          </Notice>
        ) : null}

        {saved ? <FormStatus>Saved</FormStatus> : null}

        {editing === null && drops.length === 0 ? (
          <EmptyState action={addDatesButton}>No dates yet.</EmptyState>
        ) : (
          <>
            <DropList
              drops={drops}
              countsByDate={countsByDate}
              now={now}
              editingId={editing}
              editor={editing === NEW_DROP ? null : editor}
              onEdit={openEditor}
            />
            {editing === NEW_DROP ? editor : null}
            {editing === null ? addDatesButton : null}
          </>
        )}
      </div>
    </DashboardPage>
  );
}
