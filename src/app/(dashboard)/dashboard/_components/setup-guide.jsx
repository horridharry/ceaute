"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { isSetupGuideHiddenOn } from "../_lib/focused-task-routes";

// The setup guide (approved 23 September 2026). Its state is derived on the
// server from the publication checks and is never stored, so completing a task
// anywhere updates it and a requirement that lapses on a draft brings it back.
// The only thing remembered is whether this visitor had it open, for this tab.
//
// Compact: pinned to the bottom of the screen on phones, a floating card at
// the bottom right from 640px. Expanded: a full-screen modal sheet on phones
// (a native <dialog>, so focus is trapped and Escape closes it), a non-modal
// floating panel from 640px, so the dashboard behind it stays usable.

const STORAGE_KEY = "ceaute.setupGuide.expanded";
const DESKTOP_QUERY = "(min-width: 640px)";

function subscribeToDesktop(onChange) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

function readExpanded() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// Session storage has no change event within the same tab; the guide's own
// choice is kept in state and the stored value only seeds it.
function subscribeToNothing() {
  return () => {};
}

function writeExpanded(expanded) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, expanded ? "true" : "false");
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the
    // guide still works, it just forgets.
  }
}

function Chevron({ direction }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path
        d={direction === "up" ? "m18 15-6-6-6 6" : direction === "down" ? "m6 9 6 6 6-6" : "m9 18 6-6-6-6"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressBar({ done, total }) {
  return (
    <div
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total} tasks done`}
      className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-subtle"
    >
      <span
        className="block h-full rounded-full bg-action motion-safe:transition-[width] motion-safe:duration-300"
        style={{ width: `${Math.round((done / total) * 100)}%` }}
      />
    </div>
  );
}

const TOGGLE_CLASS =
  "-my-2 -mr-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function GuideHeading({ id, headingRef, done, total, expanded, onToggle, toggleRef, panelId }) {
  return (
    <div className="flex items-center gap-2.5">
      <h2 id={id} ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight outline-none">
        Your business setup
      </h2>
      <span className="text-[13px] font-semibold tabular-nums text-ink-muted">
        {done} of {total}
      </span>
      <button
        ref={toggleRef}
        type="button"
        className={TOGGLE_CLASS}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? "Hide setup checklist" : "Show setup checklist"}
        onClick={onToggle}
      >
        <Chevron direction={expanded ? "down" : "up"} />
      </button>
    </div>
  );
}

function GuideBody({ setup, onNavigate }) {
  const next = setup.nextTask;

  return (
    <>
      {next ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3.5">
          <span className="text-xs font-semibold text-accent">Next</span>
          <span className="font-semibold">{next.name}</span>
          <span className="text-sm text-ink-muted">{next.detail}</span>
          <Link
            href={next.href}
            onClick={onNavigate}
            className="mt-1 inline-flex min-h-11 w-max items-center rounded-lg bg-action px-4 text-sm font-semibold text-white hover:bg-action-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {next.cta}
          </Link>
        </div>
      ) : null}
      <h3 className="mt-5 text-sm font-semibold">Checklist</h3>
      <ul className="mt-1">
        {setup.tasks.map((task) => (
          <li key={task.id} className="border-b border-line last:border-b-0">
            <Link
              href={task.href}
              onClick={onNavigate}
              className="flex min-h-14 items-center gap-3 rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span
                aria-hidden="true"
                className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] ${
                  task.done ? "border-ink bg-ink text-white" : "border-line-strong"
                }`}
              >
                {task.done ? <CheckMark /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={task.done ? "font-medium text-ink-muted" : "font-semibold"}>{task.name}</span>
                <span className="text-[13px] text-ink-muted">{task.done ? "Done" : task.detail}</span>
              </span>
              <span className="text-ink-subtle">
                <Chevron direction="right" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-ink-muted">
        When everything is done, publish from{" "}
        <Link href="/dashboard/settings/publication" onClick={onNavigate} className="font-semibold text-accent">
          Settings → Publication
        </Link>
        . Nothing goes live on its own.
      </p>
    </>
  );
}

export function SetupGuide({ setup }) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  // Remembered for this tab (read after hydration, so the server and the
  // first client render agree), until the visitor chooses again.
  const storedExpanded = useSyncExternalStore(subscribeToNothing, readExpanded, () => false);
  const [expandedChoice, setExpanded] = useState(null);
  const expanded = expandedChoice ?? storedExpanded;
  const [announcement, setAnnouncement] = useState("");
  const titleId = useId();
  const panelId = useId();
  const toggleRef = useRef(null);
  const headingRef = useRef(null);
  const compactRef = useRef(null);
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const closingForNavigationRef = useRef(false);
  const previousRef = useRef(null);
  const visible = Boolean(setup?.showGuide) && !isSetupGuideHiddenOn(pathname ?? "");

  // Announce progress and completion once, politely.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = setup
      ? { doneCount: setup.doneCount, showGuide: setup.showGuide }
      : null;

    if (!previous || !setup) {
      return;
    }

    if (previous.showGuide && !setup.showGuide && setup.setupComplete) {
      setAnnouncement("Setup complete. You’re ready to publish.");
    } else if (setup.showGuide && previous.doneCount !== setup.doneCount) {
      setAnnouncement(`${setup.doneCount} of ${setup.total} setup tasks done`);
    }
  }, [setup]);

  // Reserve room below the page so the compact guide never covers the last
  // field or button (globals.css pads the body by --guide-space).
  useEffect(() => {
    const root = document.documentElement;
    const node = compactRef.current;

    if (!visible || !node) {
      root.style.removeProperty("--guide-space");
      return undefined;
    }

    const update = () => {
      root.style.setProperty("--guide-space", `${Math.ceil(node.getBoundingClientRect().height) + 16}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--guide-space");
    };
  }, [visible, expanded, isDesktop]);

  const showSheet = visible && expanded && !isDesktop;
  const showPanel = visible && expanded && isDesktop;

  // The phone sheet is a modal <dialog>.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (showSheet && !dialog.open) {
      dialog.showModal();
      headingRef.current?.focus();
    }
  }, [showSheet]);

  // Moving focus into the panel on open, and back to the toggle on close.
  useEffect(() => {
    if (showPanel) {
      headingRef.current?.focus();
    } else if (!expanded && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      toggleRef.current?.focus();
    }
  }, [showPanel, expanded]);

  const setExpandedAndRemember = (value, { restoreFocus = false } = {}) => {
    restoreFocusRef.current = restoreFocus;
    setExpanded(value);
    writeExpanded(value);
  };

  const collapse = () => setExpandedAndRemember(false, { restoreFocus: true });
  // Choosing a task collapses the guide; the new page's heading takes focus
  // as it normally would.
  const collapseForNavigation = () => setExpandedAndRemember(false);

  const liveRegion = (
    <p className="sr-only" role="status" aria-live="polite">
      {announcement}
    </p>
  );

  if (!visible || !setup) {
    return liveRegion;
  }

  const done = setup.doneCount;
  const total = setup.total;

  return (
    <>
      {liveRegion}

      {showPanel ? (
        <section
          id={panelId}
          role="region"
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              collapse();
            }
          }}
          className="setup-guide-panel fixed bottom-6 right-6 z-30 flex max-h-[min(600px,calc(100dvh-96px))] w-96 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_56px_-20px_rgba(0,0,0,0.35)]"
        >
          <div className="border-b border-line px-4 pb-3 pt-3.5">
            <GuideHeading
              id={titleId}
              headingRef={headingRef}
              done={done}
              total={total}
              expanded
              onToggle={collapse}
              toggleRef={toggleRef}
              panelId={panelId}
            />
            <ProgressBar done={done} total={total} />
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3.5">
            <GuideBody setup={setup} onNavigate={collapseForNavigation} />
          </div>
        </section>
      ) : (
        <section
          ref={compactRef}
          aria-labelledby={showSheet ? undefined : titleId}
          aria-label={showSheet ? "Your business setup" : undefined}
          className="setup-guide-compact fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border-t border-line bg-surface px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3.5 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80 sm:rounded-2xl sm:border sm:px-4 sm:pb-2.5 sm:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.28)]"
        >
          <GuideHeading
            id={showSheet ? undefined : titleId}
            headingRef={showSheet ? undefined : headingRef}
            done={done}
            total={total}
            expanded={false}
            onToggle={() => setExpandedAndRemember(true)}
            toggleRef={toggleRef}
            panelId={panelId}
          />
          <ProgressBar done={done} total={total} />
          {setup.nextTask ? (
            <Link
              href={setup.nextTask.href}
              className="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="min-w-0">
                <span className="text-ink-muted">Next: </span>
                <strong className="font-semibold">{setup.nextTask.name}</strong>
              </span>
              <span className="shrink-0 text-accent">
                <Chevron direction="right" />
              </span>
            </Link>
          ) : null}
        </section>
      )}

      {showSheet ? (
        <dialog
          ref={dialogRef}
          id={panelId}
          aria-labelledby={titleId}
          onClose={() => {
            // Closing because a task link was chosen: the new page takes
            // focus. Otherwise (Escape or the toggle) focus returns to the
            // compact guide's toggle.
            if (closingForNavigationRef.current) {
              closingForNavigationRef.current = false;
              return;
            }
            collapse();
          }}
          className="setup-guide-sheet m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink backdrop:bg-scrim"
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-line px-5 pb-3.5 pt-[calc(16px+env(safe-area-inset-top,0px))]">
              <GuideHeading
                id={titleId}
                headingRef={headingRef}
                done={done}
                total={total}
                expanded
                onToggle={() => dialogRef.current?.close()}
                toggleRef={undefined}
                panelId={panelId}
              />
              <ProgressBar done={done} total={total} />
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-4">
              <GuideBody
                setup={setup}
                onNavigate={() => {
                  closingForNavigationRef.current = true;
                  collapseForNavigation();
                  dialogRef.current?.close();
                }}
              />
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
