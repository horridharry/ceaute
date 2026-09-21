import assert from "node:assert/strict";
import test from "node:test";
import {
  SENTINEL_STATE_KEY,
  createUnsavedNavigationController,
  isGuardActive,
  shouldGuardLinkClick,
} from "../src/lib/forms/unsaved-navigation.js";

const CURRENT = "https://ceaute.test/dashboard/availability?view=week";

function click(overrides = {}, anchor = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...overrides,
    anchor: {
      href: "https://ceaute.test/dashboard/treatments",
      target: "",
      hasDownload: false,
      ...anchor,
    },
  };
}

// --- isGuardActive ---------------------------------------------------------

test("isGuardActive: an empty or missing registry never guards", () => {
  assert.equal(isGuardActive(new Map()), false);
  assert.equal(isGuardActive(undefined), false);
  assert.equal(isGuardActive(null), false);
});

test("isGuardActive: any registered guard is active", () => {
  assert.equal(isGuardActive(new Map([["a", true]])), true);
  assert.equal(
    isGuardActive(
      new Map([
        ["a", true],
        ["b", true],
      ]),
    ),
    true,
  );
});

// --- shouldGuardLinkClick --------------------------------------------------

test("guards a primary unmodified click to another same-origin path", () => {
  assert.equal(shouldGuardLinkClick(click(), CURRENT), true);
  assert.equal(
    shouldGuardLinkClick(click({}, { target: "_self" }), CURRENT),
    true,
  );
});

test("guards a same-path link that changes the query", () => {
  assert.equal(
    shouldGuardLinkClick(
      click({}, { href: "https://ceaute.test/dashboard/availability?view=day" }),
      CURRENT,
    ),
    true,
  );
});

test("does not guard modifier-key clicks", () => {
  for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
    assert.equal(shouldGuardLinkClick(click({ [key]: true }), CURRENT), false, key);
  }
});

test("does not guard a non-primary button (middle or right click)", () => {
  assert.equal(shouldGuardLinkClick(click({ button: 1 }), CURRENT), false);
  assert.equal(shouldGuardLinkClick(click({ button: 2 }), CURRENT), false);
});

test("does not guard a click something else already handled", () => {
  assert.equal(
    shouldGuardLinkClick(click({ defaultPrevented: true }), CURRENT),
    false,
  );
});

test("does not guard a link with another target", () => {
  for (const target of ["_blank", "_parent", "_top", "preview"]) {
    assert.equal(
      shouldGuardLinkClick(click({}, { target }), CURRENT),
      false,
      target,
    );
  }
});

test("does not guard a download link", () => {
  assert.equal(
    shouldGuardLinkClick(click({}, { hasDownload: true }), CURRENT),
    false,
  );
});

test("does not guard another origin or a non-web scheme", () => {
  for (const href of [
    "https://example.com/dashboard/treatments",
    "http://ceaute.test/dashboard/treatments",
    "https://ceaute.test:8443/dashboard/treatments",
    "mailto:hello@ceaute.test",
    "tel:+441234567890",
  ]) {
    assert.equal(shouldGuardLinkClick(click({}, { href }), CURRENT), false, href);
  }
});

test("does not guard a hash-only change", () => {
  assert.equal(
    shouldGuardLinkClick(
      click({}, {
        href: "https://ceaute.test/dashboard/availability?view=week#blocked",
      }),
      CURRENT,
    ),
    false,
  );
});

test("does not guard the same path and query", () => {
  assert.equal(shouldGuardLinkClick(click({}, { href: CURRENT }), CURRENT), false);
});

test("does not guard a missing or unparsable link", () => {
  assert.equal(shouldGuardLinkClick(null, CURRENT), false);
  assert.equal(shouldGuardLinkClick(click({}, { href: "" }), CURRENT), false);
  assert.equal(shouldGuardLinkClick(click(), "not a url"), false);
});

// --- controller with a fake browser ---------------------------------------

function fakeBrowser(href = CURRENT) {
  const listeners = new Map();
  // The provider arrived at `href` from a previous page.
  const entries = [
    { state: { __NA: true }, href: "https://ceaute.test/dashboard" },
    { state: { __NA: true }, href },
  ];
  let index = 1;
  const pushes = [];
  const pendings = [];
  const queuedPops = [];

  const location = {
    get href() {
      return entries[index].href;
    },
  };
  const history = {
    get state() {
      return entries[index].state;
    },
    pushState(state, _unused, url) {
      entries.splice(index + 1);
      entries.push({ state, href: url });
      index += 1;
    },
    back() {
      queuedPops.push(-1);
    },
  };
  const eventTarget = {
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((each) => each !== fn),
      );
    },
  };

  function dispatch(type, event) {
    for (const fn of listeners.get(type) ?? []) {
      fn(event);
      if (event.stopped) break;
    }
    return event;
  }

  function popEvent() {
    return {
      state: entries[index].state,
      stopped: false,
      stopImmediatePropagation() {
        this.stopped = true;
      },
    };
  }

  return {
    location,
    history,
    entries,
    pushes,
    pendings,
    get index() {
      return index;
    },
    listenerCount() {
      let count = 0;
      for (const fns of listeners.values()) count += fns.length;
      return count;
    },
    // Runs history.back() calls the controller queued (async in a browser).
    flushPops() {
      while (queuedPops.length) {
        index += queuedPops.shift();
        dispatch("popstate", popEvent());
      }
    },
    // The user pressing the browser's Back button.
    userBack() {
      index -= 1;
      return dispatch("popstate", popEvent());
    },
    click(payload) {
      const event = {
        payload,
        prevented: false,
        propagationStopped: false,
        preventDefault() {
          this.prevented = true;
        },
        stopPropagation() {
          this.propagationStopped = true;
        },
      };
      dispatch("click", event);
      return event;
    },
    beforeUnload() {
      const event = {
        prevented: false,
        preventDefault() {
          this.prevented = true;
        },
      };
      dispatch("beforeunload", event);
      return event;
    },
    controller() {
      return createUnsavedNavigationController({
        eventTarget,
        history,
        location,
        readLinkClick: (event) => event.payload,
        push: (to) => pushes.push(to),
        onPendingChange: (pending) => pendings.push(pending),
      });
    },
  };
}

test("controller: with no guard, nothing is attached or pushed", () => {
  const browser = fakeBrowser();
  const controller = browser.controller();

  assert.equal(browser.listenerCount(), 0);
  assert.equal(browser.entries.length, 2);
  assert.equal(browser.beforeUnload().prevented, false);
  const event = browser.click(click());
  assert.equal(event.prevented, false);

  controller.navigate("/dashboard/treatments");
  assert.deepEqual(browser.pushes, ["/dashboard/treatments"]);
});

test("controller: an active guard pushes one sentinel that keeps Next's state", () => {
  const browser = fakeBrowser();
  const controller = browser.controller();
  controller.register("a");
  controller.register("b");

  assert.equal(browser.entries.length, 3);
  assert.deepEqual(browser.entries[2], {
    state: { __NA: true, [SENTINEL_STATE_KEY]: true },
    href: CURRENT,
  });
  assert.equal(browser.beforeUnload().prevented, true);
});

test("controller: a guarded link asks, Keep editing stays, Discard removes the sentinel then navigates", () => {
  const browser = fakeBrowser();
  const controller = browser.controller();
  controller.register("a");

  const event = browser.click(click());
  assert.equal(event.prevented, true);
  assert.equal(event.propagationStopped, true);
  assert.deepEqual(controller.getPending(), {
    type: "push",
    href: "https://ceaute.test/dashboard/treatments",
  });

  controller.keepEditing();
  assert.equal(controller.getPending(), null);
  assert.equal(browser.index, 2);
  assert.deepEqual(browser.pushes, []);

  browser.click(click());
  controller.discard();
  assert.deepEqual(browser.pushes, []);
  browser.flushPops();
  assert.equal(browser.index, 1);
  assert.deepEqual(browser.pushes, ["https://ceaute.test/dashboard/treatments"]);
  assert.equal(browser.listenerCount(), 0);
});

test("controller: Back asks; Keep editing restores the sentinel; Discard goes back once more", () => {
  const browser = fakeBrowser();
  const controller = browser.controller();
  controller.register("a");

  const pop = browser.userBack();
  assert.equal(pop.stopped, true);
  assert.deepEqual(controller.getPending(), { type: "back" });

  controller.keepEditing();
  assert.equal(browser.index, 2);
  assert.equal(browser.entries[2].state[SENTINEL_STATE_KEY], true);

  browser.userBack();
  controller.discard();
  assert.equal(browser.listenerCount(), 0);
  browser.flushPops();
  assert.equal(browser.index, 0);
});

test("controller: releasing in place removes the sentinel and swallows its popstate", () => {
  const browser = fakeBrowser();
  const controller = browser.controller();
  controller.register("a");
  // Next rewrites the entry's state after a refresh, dropping our key.
  browser.entries[2].state = { __NA: true };

  controller.unregister("a");
  browser.flushPops();
  assert.equal(browser.index, 1);
  assert.equal(controller.getPending(), null);
  assert.equal(browser.listenerCount(), 0);
});

test("controller: allowNextNavigation-style release leaves history alone", () => {
  const browser = fakeBrowser();
  const controller = browser.controller();
  controller.register("a");
  controller.unregister("a", { navigating: true });
  browser.flushPops();
  assert.equal(browser.index, 2);
  assert.equal(browser.listenerCount(), 0);

  // A later guard on the same entry reuses that sentinel.
  controller.register("a");
  assert.equal(browser.entries.length, 3);
});

test("controller: navigate asks only when it leaves the page", () => {
  const browser = fakeBrowser();
  const controller = browser.controller();
  controller.register("a");

  controller.navigate(`${CURRENT}#blocked`);
  assert.deepEqual(browser.pushes, [`${CURRENT}#blocked`]);

  controller.navigate("/dashboard/treatments");
  assert.deepEqual(controller.getPending(), {
    type: "push",
    href: "/dashboard/treatments",
  });
});
