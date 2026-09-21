import { useCallback, useContext, useEffect, useId } from "react";
import { UnsavedChangesContext } from "./unsaved-changes-provider";

function useUnsavedChangesContext(hookName) {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error(`${hookName} must be used inside UnsavedChangesProvider.`);
  }
  return context;
}

// Registers one unsaved-changes guard while `isDirty` is true. Leaving the
// page asks first while any guard is registered.
//
// allowNextNavigation(): call it just before navigating away yourself (for
// example after a successful save that redirects), so that navigation is not
// intercepted. It releases this guard until `isDirty` next becomes true.
// Prefer navigate(href) from useUnsavedChangesNavigation when the navigation
// should still ask.
export function useUnsavedChanges(isDirty) {
  const { register, unregister } = useUnsavedChangesContext(
    "useUnsavedChanges",
  );
  const id = useId();

  useEffect(() => {
    if (!isDirty) return undefined;
    register(id);
    return () => unregister(id);
  }, [id, isDirty, register, unregister]);

  const allowNextNavigation = useCallback(() => {
    unregister(id, { navigating: true });
  }, [id, unregister]);

  return { allowNextNavigation };
}

// navigate(href): client-side navigation that runs the same check as a link.
// With unsaved changes it shows the dialog, and Discard changes continues to
// `href`; otherwise it navigates straight away.
export function useUnsavedChangesNavigation() {
  const { navigate } = useUnsavedChangesContext("useUnsavedChangesNavigation");
  return { navigate };
}
