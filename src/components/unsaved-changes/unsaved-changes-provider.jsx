"use client";

// Shared unsaved-changes protection. Mount once around the screens that may
// use it; a form opts in with useUnsavedChanges(isDirty)
// (./use-unsaved-changes.js). With no active guard this does nothing: no
// listeners, no history entries, nothing intercepted.
//
// While a guard is active it covers reload, closing the tab and leaving the
// site (the browser's own beforeunload prompt), links within the site (a
// capture-phase click listener on window, which runs before React's listener
// on the document root, so Next's <Link> never starts), browser Back (a
// sentinel history entry, see src/lib/forms/unsaved-navigation.js), and code
// that navigates through navigate(href).
import {
  createContext,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createUnsavedNavigationController } from "@/lib/forms/unsaved-navigation";

export const UnsavedChangesContext = createContext(null);

function readLinkClick(event) {
  const origin = event.target;
  if (!(origin instanceof Element)) return null;
  const anchor = origin.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  return {
    button: event.button,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    defaultPrevented: event.defaultPrevented,
    anchor: {
      href: anchor.href,
      target: anchor.target,
      hasDownload: anchor.hasAttribute("download"),
    },
  };
}

export function UnsavedChangesProvider({ children }) {
  const router = useRouter();
  const routerRef = useRef(router);
  const controllerRef = useRef(null);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Created on first use rather than during render: guards register from
  // their own effects, which run before this provider's effects, and the
  // controller needs `window`.
  const getController = useCallback(() => {
    if (!controllerRef.current) {
      controllerRef.current = createUnsavedNavigationController({
        eventTarget: window,
        history: window.history,
        location: window.location,
        readLinkClick,
        push: (href) => routerRef.current.push(href),
        onPendingChange: setPending,
      });
    }
    return controllerRef.current;
  }, []);

  useEffect(
    () => () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    },
    [],
  );

  const value = useMemo(
    () => ({
      register: (id) => getController().register(id),
      unregister: (id, options) => getController().unregister(id, options),
      navigate: (href) => getController().navigate(href),
    }),
    [getController],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={pending !== null}
        onKeepEditing={() => controllerRef.current?.keepEditing()}
        onDiscard={() => controllerRef.current?.discard()}
      />
    </UnsavedChangesContext.Provider>
  );
}

function UnsavedChangesDialog({ open, onKeepEditing, onDiscard }) {
  const dialogRef = useRef(null);
  const keepEditingRef = useRef(null);
  const returnFocusRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement;
      dialog.showModal();
      keepEditingRef.current?.focus();
    } else if (!open) {
      if (dialog.open) dialog.close();
      const previous = returnFocusRef.current;
      returnFocusRef.current = null;
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={(event) => {
        // Escape means Keep editing. Handled here as well as in onCancel
        // because not every browser turns Escape into a cancel event;
        // preventDefault stops the ones that do from firing it too.
        if (event.key === "Escape") {
          event.preventDefault();
          onKeepEditing();
        }
      }}
      onCancel={(event) => {
        // Escape means Keep editing. The dialog is closed by the effect
        // above once the pending navigation is cleared.
        event.preventDefault();
        onKeepEditing();
      }}
      onClose={() => {
        // A browser may still close the dialog itself (Chrome does on a
        // repeated Escape); treat that as Keep editing too. A no-op when the
        // effect above closed it.
        onKeepEditing();
      }}
      className="m-auto w-[calc(100%-2.5rem)] max-w-[400px] rounded-2xl bg-white p-5 text-black shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-lg font-semibold tracking-tight">
        Discard unsaved changes?
      </h2>
      <p id={bodyId} className="mt-2 text-sm text-black/60">
        You&apos;ve made changes on this page that haven&apos;t been saved.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          ref={keepEditingRef}
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={onKeepEditing}
        >
          Keep editing
        </Button>
        <Button
          type="button"
          variant="primary"
          className="min-h-11"
          onClick={onDiscard}
        >
          Discard changes
        </Button>
      </div>
    </dialog>
  );
}
