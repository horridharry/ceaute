import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DisplayPhotoForm } from "../src/app/(dashboard)/dashboard/profile/_components/display-photo-form.jsx";
import { ProviderPageForm } from "../src/app/(dashboard)/dashboard/profile/_components/provider-page-form.jsx";
import { PortfolioManager } from "../src/app/(dashboard)/dashboard/profile/portfolio/_components/portfolio-manager.jsx";
import {
  describeFileProblem,
  isLastVisiblePhoto,
} from "../src/app/(dashboard)/dashboard/profile/portfolio/_lib/portfolio-rules.js";
import { PublicationPanel } from "../src/app/(dashboard)/dashboard/settings/publication/_components/publication-panel.jsx";

const render = (element) => renderToStaticMarkup(element);
const count = (html, pattern) => (html.match(pattern) ?? []).length;
const read = (path) => readFileSync(path, "utf8");
const noop = async () => ({});

const providerPage = {
  businessName: "Studio Nala",
  username: "studionala",
  providerCategory: "Nails",
  biography: "Gel, BIAB and hand-painted nail art.",
};

test("profile has no publication controls and puts the display photo first", () => {
  const page = read("src/app/(dashboard)/dashboard/profile/page.jsx");
  const code = page.replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /Publish|PublicationActions|View live page|preview/i);
  assert.ok(page.indexOf("<DisplayPhotoForm") < page.indexOf("<ProviderPageForm"), "photo directly under the heading");
  assert.match(page, /<DashboardPage title="Profile">/);
});

test("profile details: one form, one Save, fields tight to their labels, no hidden error text", () => {
  const html = render(h(ProviderPageForm, { providerPage, updateProviderPage: noop }));
  assert.equal(count(html, /type="submit"/g), 1);
  assert.doesNotMatch(html, /Preview page|is valid</, "no preview link or invisible placeholder errors");
  assert.doesNotMatch(html, /<h2/, "no duplicate Profile heading");
  assert.match(html, /Your page: ceaute\.com\/@studionala/);
  assert.match(html, /36 \/ 500/);
  assert.equal(count(html, /class="flex flex-1 flex-col gap-1\.5"/g), 4);
});

test("the display photo is optional and says so", () => {
  const empty = render(h(DisplayPhotoForm, { photoUrl: null, uploadDisplayPhoto: noop, removeDisplayPhoto: noop }));
  assert.match(empty, /aria-label="Display photo"/);
  assert.match(empty, />Add photo</);
  assert.match(empty, /Optional\. Shown next to your name\. JPEG, PNG or WebP up to 5 MB\./);
  assert.doesNotMatch(empty, />Remove</);

  const withPhoto = render(h(DisplayPhotoForm, { photoUrl: "https://example.test/p.jpg", uploadDisplayPhoto: noop, removeDisplayPhoto: noop }));
  assert.match(withPhoto, />Change photo</);
  assert.match(withPhoto, />Remove</);
});

const notReady = {
  ready: false,
  missing: ["At least one enabled working day", "Stripe payments ready"],
  requirements: [
    { label: "Business name", href: "/dashboard/profile", met: true },
    { label: "At least one enabled working day", href: "/dashboard/availability", met: false },
    { label: "Stripe payments ready", href: "/dashboard/settings/payments", met: false },
  ],
};

test("publication: not ready lists what is missing, each linked, with Publish unavailable and why", () => {
  const html = render(h(PublicationPanel, { status: "draft", username: "studionala", readiness: notReady, publishPage: noop, unpublishPage: noop }));
  assert.match(html, /Not live/);
  assert.match(html, /href="\/dashboard\/availability"/);
  assert.match(html, /href="\/dashboard\/settings\/payments"/);
  assert.doesNotMatch(html, />Business name</, "met requirements are not repeated");
  assert.match(html, /disabled=""[^>]*aria-describedby="publish-unavailable"[^>]*>Publish page|aria-describedby="publish-unavailable"[^>]*disabled=""[^>]*>Publish page|<button[^>]*disabled=""[^>]*>Publish page/);
  assert.match(html, /id="publish-unavailable"/);
  assert.match(html, /href="\/dashboard\/profile\/preview"/);
});

test("publication: ready offers Publish and Preview", () => {
  const html = render(h(PublicationPanel, { status: "draft", username: "studionala", readiness: { ready: true, missing: [], requirements: [] }, publishPage: noop, unpublishPage: noop }));
  assert.match(html, /Everything’s in place/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Publish page<\/button>/);
  assert.doesNotMatch(html, /disabled=""[^>]*>Publish page/);
});

test("publication: live offers View page and a confirmed Unpublish", () => {
  const html = render(h(PublicationPanel, { status: "published", username: "studionala", readiness: { ready: true, missing: [], requirements: [] }, publishPage: noop, unpublishPage: noop }));
  assert.match(html, /Live/);
  assert.match(html, /href="\/@studionala"/);
  assert.match(html, />Unpublish page</);
  assert.match(html, /Unpublish your page\?/);
  assert.match(html, /Existing bookings are not affected\./);
  assert.doesNotMatch(html, />Publish page</);
});

test("publication: a suspended page cannot be published", () => {
  const html = render(h(PublicationPanel, { status: "suspended", username: "studionala", readiness: notReady, publishPage: noop, unpublishPage: noop }));
  assert.match(html, /Suspended pages cannot be published/);
  assert.doesNotMatch(html, />Publish page</);
});

test("publication controls live only in Settings → Publication, with unchanged checks", () => {
  const actions = read("src/app/(dashboard)/dashboard/settings/publication/actions.js");
  assert.match(actions, /rpc\("publish_provider_page"\)/);
  assert.match(actions, /rpc\("unpublish_provider_page"\)/);
  assert.match(actions, /getProviderPagePublicationReadiness/);
  assert.match(actions, /Suspended pages cannot be published\./);
  assert.doesNotMatch(read("src/app/(dashboard)/dashboard/profile/actions.js"), /publish_provider_page/);
  assert.match(read("src/app/(dashboard)/dashboard/profile/preview/page.jsx"), /href="\/dashboard\/settings\/publication"/);
});

const photos = Array.from({ length: 8 }, (_, index) => ({
  id: `p${index + 1}`,
  caption: "",
  is_visible: index < 7,
  signed_url: `https://example.test/${index + 1}.jpg`,
}));
const actions = { upload: noop, caption: noop, move: noop, visibility: noop, remove: noop };

test("portfolio view: the first six visible photos, View all, and the hidden count", () => {
  const html = render(h(PortfolioManager, { images: photos, isLive: true, actions }));
  assert.equal(count(html, /data-portfolio-image-id=/g), 6);
  assert.match(html, /aria-expanded="false"[^>]*>View all 7 photos/);
  assert.match(html, /1 hidden photo\. Only you can see it\./);
  assert.match(html, />Edit photos</);
  assert.doesNotMatch(html, /Actions for photo/, "no management controls while viewing");
});

test("portfolio with no photos opens straight into adding them", () => {
  const html = render(h(PortfolioManager, { images: [], isLive: false, actions }));
  assert.match(html, /No photos yet\. Add photos of your work so customers can see your style\./);
  assert.match(html, /type="file" multiple=""/);
});

test("the last visible photo is recognised; files are checked before upload", () => {
  const onlyOne = [{ id: "a", is_visible: true }, { id: "b", is_visible: false }];
  assert.equal(isLastVisiblePhoto(onlyOne, onlyOne[0]), true);
  assert.equal(isLastVisiblePhoto(onlyOne, onlyOne[1]), false, "a hidden photo is not the last visible one");
  assert.equal(isLastVisiblePhoto(photos, photos[0]), false);
  assert.equal(describeFileProblem({ name: "IMG_2041.heic", type: "image/heic", size: 100 }), "Couldn’t add IMG_2041.heic. Use JPEG, PNG or WebP up to 5 MB.");
  assert.equal(describeFileProblem({ name: "big.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 }), "Couldn’t add big.jpg. It’s larger than 5 MB.");
  assert.equal(describeFileProblem({ name: "ok.webp", type: "image/webp", size: 1000 }), "");
});

test("every portfolio action reports a status and a message; deletions ask first", () => {
  const source = read("src/app/(dashboard)/dashboard/profile/portfolio/actions.js");
  assert.doesNotMatch(source, /return "[^"]*";/, "no bare message strings");
  assert.match(source, /Moved to position \$\{targetIndex \+ 1\} of \$\{images\.length\}\./);
  const manager = read("src/app/(dashboard)/dashboard/profile/portfolio/_components/portfolio-manager.jsx");
  assert.match(manager, /title="Delete this photo\?"/);
  assert.match(manager, /isLive && isLastVisiblePhoto\(images, image\)/);
  assert.match(manager, /label: "Move earlier"/);
  assert.match(manager, /label: "Move later"/);
});
