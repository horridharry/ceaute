// The pinned bar at the bottom of the Weekly hours form. Presentational: its
// Save hours button is the editor form's submit button, so it never submits
// anything itself.
import { Button } from "@/components/ui/button";
import { formatChangedCount, formatInvalidMessage } from "../_lib/schedule-form";

// status: "hidden" | "dirty" | "invalid" | "saving" | "saved" | "error"
export function SaveHoursBar({
  status,
  changedCount,
  invalidDays,
  errorMessage,
  saveButtonRef,
  onDiscard,
  onShowInvalid,
}) {
  if (status === "hidden") {
    return null;
  }

  const saving = status === "saving";
  const showButtons = status !== "saved";

  let message;

  if (status === "invalid") {
    message = (
      <button
        type="button"
        onClick={onShowInvalid}
        className="min-h-11 text-left text-sm font-medium text-red-600 underline underline-offset-2"
      >
        {formatInvalidMessage(invalidDays)}
      </button>
    );
  } else if (status === "error") {
    message = <span className="text-red-600">{errorMessage}</span>;
  } else if (saving) {
    message = "Saving…";
  } else if (status === "saved") {
    message = "Hours saved";
  } else {
    message = formatChangedCount(changedCount);
  }

  return (
    <div
      role="region"
      aria-label="Unsaved weekly hours"
      className="sticky bottom-0 z-10 border-t border-black/10 bg-white pt-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div aria-live="polite" className="min-w-32 flex-1 text-sm">
          {message}
        </div>
        {showButtons ? (
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={saving}
              onClick={onDiscard}
            >
              Discard
            </Button>
            <Button
              ref={saveButtonRef}
              type="submit"
              variant="primary"
              className="min-h-11"
              disabled={saving || status === "invalid"}
            >
              Save hours
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
