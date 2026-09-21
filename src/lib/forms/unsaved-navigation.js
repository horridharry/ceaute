// Unsaved-changes navigation guard: the pure decisions and the history state
// machine behind UnsavedChangesProvider
// (src/components/unsaved-changes/unsaved-changes-provider.jsx).
//
// Nothing here reads `window`, `document` or `history` directly. The provider
// passes in the browser objects, so `node --test` can drive the whole flow
// with fakes. The module knows nothing about any particular form or screen.

// Marks the extra history entry the guard pushes while a form has unsaved
// changes. Next's App Router keeps its own keys (`__NA`, its route tree) in
// `history.state`; the sentinel copies them and adds this one.
export const SENTINEL_STATE_KEY = "__ceauteUnsavedGuard";

// guards: a Map (or anything with a numeric `size`) of active guard ids.
// An empty or missing registry never guards anything.
export function isGuardActive(guards) {
  return Boolean(guards) && guards.size > 0;
}

// True when `href` and `currentUrl` are the same origin but a different path
// or query. A change to the #hash alone stays on the page, as does the exact
// same path and query.
export function leavesCurrentPage(href, currentUrl) {
  let current;
  let next;
  try {
    current = new URL(currentUrl);
    next = new URL(href, current);
  } catch {
    return false;
  }
  if (next.origin !== current.origin) return false;
  return (
    next.pathname !== current.pathname || next.search !== current.search
  );
}

// Decides whether a click on a link should ask first. Only a primary,
// unmodified click that would navigate this tab to another page of the same
// site is guarded. Everything else is left alone: a new tab or window
// (modifier keys, middle click, a target), a download, another origin (the
// browser's own beforeunload prompt covers that), or a link that stays on the
// current page.
export function shouldGuardLinkClick(click, currentUrl) {
  if (!click || !click.anchor) return false;
  const { button, metaKey, ctrlKey, shiftKey, altKey, defaultPrevented } =
    click;
  if (defaultPrevented) return false;
  if (button !== 0) return false;
  if (metaKey || ctrlKey || shiftKey || altKey) return false;

  const { href, target, hasDownload } = click.anchor;
  if (!href) return false;
  if (hasDownload) return false;
  const normalisedTarget = (target ?? "").toLowerCase();
  if (normalisedTarget !== "" && normalisedTarget !== "_self") return false;

  return leavesCurrentPage(href, currentUrl);
}

// The history and event state machine. `env`:
//   eventTarget  where the listeners go (window)
//   history      { state, pushState(state, unused, url), back() }
//   location     { href } read live
//   readLinkClick(event)  -> the `click` shape above, or null (DOM-specific)
//   push(href)   client-side navigation (the App Router's router.push)
//   onPendingChange(pending)  pending is null or { type: "push", href } or
//                             { type: "back" }; the provider shows the dialog
//                             while it is not null.
//
// With no active guard nothing is attached and history is never touched.
//
// Back and forward. When a guard becomes active the current entry is
// duplicated with a sentinel entry at the same URL (keeping Next's state keys,
// so Next's patched pushState passes it straight through without dispatching
// anything). Pressing Back leaves the sentinel and lands on the original
// entry, at the same URL, so nothing visible changes; the popstate listener
// then asks. Keep editing pushes the sentinel again; Discard changes goes back
// once more, to where the provider was heading.
//
// Ordering with Next: Next's App Router listens for popstate on window
// (non-capture) and dispatches a traverse. This listener is registered on
// window in the capture phase. For listeners on the event's own target,
// browsers run capture listeners before non-capture ones (DOM standard since
// 2021), so on the popstates this module causes or answers it runs first and
// calls stopImmediatePropagation(), and Next never sees them. Every other
// popstate is left for Next. If an older browser ran Next first, Next would
// only restore the same URL with the same tree, which is harmless.
//
// The sentinel is tracked in memory as well as in history.state, because Next
// rewrites the current entry's state with replaceState after a refresh (for
// example revalidatePath in a server action) and drops custom keys.
//
// When the guard releases without leaving (saved, or discarded in place) and
// the provider is still on the sentinel, the sentinel is removed with
// history.back() and that one popstate is swallowed.
export function createUnsavedNavigationController(env) {
  const { eventTarget, history, location, readLinkClick, push } = env;
  const onPendingChange = env.onPendingChange ?? (() => {});

  const guards = new Map();
  let listening = false;
  let popListening = false;
  // { href } while the current history entry is believed to be our sentinel.
  let sentinel = null;
  // { then } while waiting for the popstate caused by removing the sentinel.
  let cleanup = null;
  let pending = null;
  let disposed = false;

  function setPending(next) {
    pending = next;
    onPendingChange(pending);
  }

  function onClick(event) {
    if (!isGuardActive(guards)) return;
    const click = readLinkClick(event);
    if (!click || !shouldGuardLinkClick(click, location.href)) return;
    event.preventDefault();
    event.stopPropagation();
    setPending({ type: "push", href: click.anchor.href });
  }

  function onBeforeUnload(event) {
    if (!isGuardActive(guards)) return;
    // Shows the browser's own prompt. Known limitation: iOS Safari never
    // shows a beforeunload prompt, so reload, closing the tab and typing an
    // address are unprotected there.
    event.preventDefault();
    // Legacy support (Chrome/Edge before 119 need returnValue set).
    event.returnValue = true;
  }

  function onPopState(event) {
    if (cleanup) {
      // The popstate from removing our sentinel: same URL, nothing to do.
      event.stopImmediatePropagation();
      const { then } = cleanup;
      cleanup = null;
      if (isGuardActive(guards)) {
        if (!pending) pushSentinel();
      } else {
        detachPopState();
      }
      then?.();
      return;
    }
    if (!isGuardActive(guards)) return;

    if (event.state && event.state[SENTINEL_STATE_KEY]) {
      // Forward (or back from a #hash entry) onto a sentinel: still on the
      // page with the edits, so there is nothing to ask. Next handles it.
      sentinel = { href: location.href };
      if (pending && pending.type === "back") setPending(null);
      return;
    }

    if (sentinel && location.href === sentinel.href) {
      // Back from the sentinel to the original entry: ask first.
      event.stopImmediatePropagation();
      sentinel = null;
      setPending({ type: "back" });
      return;
    }

    // Somewhere else (for example a jump of several entries from the
    // browser's history menu). This cannot be stopped; Next handles it.
    sentinel = null;
  }

  function attach() {
    if (!listening) {
      eventTarget.addEventListener("click", onClick, true);
      eventTarget.addEventListener("beforeunload", onBeforeUnload);
      listening = true;
    }
    if (!popListening) {
      eventTarget.addEventListener("popstate", onPopState, true);
      popListening = true;
    }
  }

  function detachInterception() {
    if (!listening) return;
    eventTarget.removeEventListener("click", onClick, true);
    eventTarget.removeEventListener("beforeunload", onBeforeUnload);
    listening = false;
  }

  function detachPopState() {
    if (!popListening) return;
    eventTarget.removeEventListener("popstate", onPopState, true);
    popListening = false;
  }

  function pushSentinel() {
    const state = history.state;
    if (state && state[SENTINEL_STATE_KEY]) {
      // Already on a sentinel (left behind by allowNextNavigation).
      sentinel = { href: location.href };
      return;
    }
    history.pushState(
      { ...(state ?? {}), [SENTINEL_STATE_KEY]: true },
      "",
      location.href,
    );
    sentinel = { href: location.href };
  }

  function activate() {
    attach();
    // Wait for a sentinel removal in flight; its popstate pushes again.
    if (cleanup) return;
    if (!sentinel && !pending) pushSentinel();
  }

  // navigating: a navigation is about to happen, so leave the sentinel alone
  // (removing it with history.back() would race that navigation).
  // then: runs once history is settled.
  function deactivate({ navigating = false, then } = {}) {
    detachInterception();
    if (pending) setPending(null);

    if (cleanup) {
      const previous = cleanup.then;
      cleanup.then = () => {
        previous?.();
        then?.();
      };
      return;
    }

    const onSentinel = sentinel && location.href === sentinel.href;
    sentinel = null;
    if (onSentinel && !navigating) {
      cleanup = { then };
      history.back();
      return;
    }
    detachPopState();
    then?.();
  }

  function sync(options) {
    if (disposed) return;
    if (isGuardActive(guards)) activate();
    else deactivate(options);
  }

  return {
    register(id) {
      if (guards.has(id)) return;
      guards.set(id, true);
      sync();
    },

    // navigating: true when the caller navigates straight after (see
    // allowNextNavigation in use-unsaved-changes.js).
    unregister(id, { navigating = false } = {}) {
      if (!guards.delete(id)) return;
      sync({ navigating });
    },

    // Code-driven navigation that asks first, like a guarded link.
    navigate(href) {
      if (disposed) return;
      if (!isGuardActive(guards)) {
        if (cleanup) {
          const previous = cleanup.then;
          cleanup.then = () => {
            previous?.();
            push(href);
          };
          return;
        }
        push(href);
        return;
      }
      if (!leavesCurrentPage(href, location.href)) {
        push(href);
        return;
      }
      setPending({ type: "push", href });
    },

    keepEditing() {
      const was = pending;
      if (!was) return;
      setPending(null);
      if (was.type === "back" && isGuardActive(guards) && !cleanup) {
        pushSentinel();
      }
    },

    discard() {
      const was = pending;
      if (!was) return;
      setPending(null);
      guards.clear();
      if (was.type === "back") {
        // Already on the original entry; go back once more to where the
        // provider was heading. Next's popstate listener handles that.
        deactivate({ navigating: true });
        history.back();
        return;
      }
      // Remove the sentinel first (its popstate is swallowed), then navigate.
      deactivate({ then: () => push(was.href) });
    },

    getPending() {
      return pending;
    },

    isActive() {
      return isGuardActive(guards);
    },

    // Provider unmount: stop listening. History is left as it is.
    dispose() {
      disposed = true;
      guards.clear();
      detachInterception();
      detachPopState();
      sentinel = null;
      cleanup = null;
      pending = null;
    },
  };
}
