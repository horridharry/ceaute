import assert from "node:assert/strict";
import test from "node:test";
import {
  PROVIDER_MENU,
  PROVIDER_PREVIEW_HREF,
  activeMenuItemId,
  viewYourPageHref,
} from "../src/components/app-header/provider-menu.js";

const items = PROVIDER_MENU.filter((entry) => !entry.separator);

test("the menu lists the approved sections in the approved order and labels", () => {
  assert.deepEqual(
    items.map((item) => item.label),
    [
      "Home",
      "Bookings",
      "Availability",
      "Locations",
      "Treatments",
      "Treatment groups",
      "Add-ons",
      "Profile",
      "Portfolio",
      "Booking settings",
      "Payments",
      "Publication",
    ],
  );
});

test("separators sit only after Bookings, Add-ons and Portfolio", () => {
  const separatorAfter = PROVIDER_MENU.flatMap((entry, index) =>
    entry.separator ? [PROVIDER_MENU[index - 1].id] : [],
  );

  assert.deepEqual(separatorAfter, ["bookings", "add-ons", "portfolio"]);
  assert.equal(PROVIDER_MENU[0].separator, undefined);
  assert.equal(PROVIDER_MENU.at(-1).separator, undefined);
});

test("separators carry no labels and no entry has children or a group", () => {
  for (const entry of PROVIDER_MENU) {
    if (entry.separator) {
      assert.deepEqual(Object.keys(entry), ["separator"]);
      continue;
    }

    assert.deepEqual(
      Object.keys(entry).filter((key) => !["id", "label", "href", "match"].includes(key)),
      [],
      `${entry.id} has unexpected keys`,
    );
  }
});

test("every section has a unique id and href, and hrefs are dashboard routes", () => {
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.equal(new Set(items.map((item) => item.href)).size, items.length);
  for (const item of items) {
    assert.match(item.href, /^\/dashboard(\/|$)/);
  }
});

test("activeMenuItemId matches each section and its descendants", () => {
  const cases = [
    ["/dashboard", "home"],
    ["/dashboard/bookings", "bookings"],
    ["/dashboard/bookings/abc-123", "bookings"],
    ["/dashboard/availability", "availability"],
    ["/dashboard/locations", "locations"],
    ["/dashboard/locations/new", "locations"],
    ["/dashboard/treatments", "treatments"],
    ["/dashboard/treatments/xyz/edit", "treatments"],
    ["/dashboard/treatment-groups", "treatment-groups"],
    ["/dashboard/treatment-groups/new", "treatment-groups"],
    ["/dashboard/add-ons", "add-ons"],
    ["/dashboard/add-ons/abc/edit", "add-ons"],
    ["/dashboard/profile", "profile"],
    ["/dashboard/profile/portfolio", "portfolio"],
    ["/dashboard/settings/booking", "booking-settings"],
    ["/dashboard/settings/payments", "payments"],
    ["/dashboard/settings/publication", "publication"],
    ["/dashboard/availability/", "availability"],
  ];

  for (const [pathname, expected] of cases) {
    assert.equal(activeMenuItemId(pathname), expected, pathname);
  }
});

test("Treatment groups and Add-ons never activate Treatments", () => {
  assert.notEqual(activeMenuItemId("/dashboard/treatment-groups"), "treatments");
  assert.notEqual(activeMenuItemId("/dashboard/add-ons"), "treatments");
  assert.notEqual(activeMenuItemId("/dashboard/treatmentsx"), "treatments");
});

test("exact entries match only themselves", () => {
  assert.equal(activeMenuItemId("/dashboard/unknown"), null);
  assert.notEqual(activeMenuItemId("/dashboard/profile/portfolio"), "profile");
});

test("the preview, onboarding and unknown routes have no active item", () => {
  for (const pathname of [
    PROVIDER_PREVIEW_HREF,
    "/dashboard/onboarding",
    "/dashboard/settings",
    "/dashboard/nope",
    "/account/settings",
    "/discover",
    "",
    undefined,
  ]) {
    assert.equal(activeMenuItemId(pathname), null, String(pathname));
  }
});

test("viewYourPageHref opens the live page only when published with a username", () => {
  assert.equal(viewYourPageHref({ status: "published", username: "studionia" }), "/@studionia");
  assert.equal(viewYourPageHref({ status: "draft", username: "studionia" }), PROVIDER_PREVIEW_HREF);
  assert.equal(viewYourPageHref({ status: "published", username: "" }), PROVIDER_PREVIEW_HREF);
  assert.equal(viewYourPageHref({ status: "published", username: null }), PROVIDER_PREVIEW_HREF);
  assert.equal(viewYourPageHref({ status: "suspended", username: "x" }), PROVIDER_PREVIEW_HREF);
  assert.equal(viewYourPageHref(), PROVIDER_PREVIEW_HREF);
  assert.equal(PROVIDER_PREVIEW_HREF, "/dashboard/profile/preview");
});
