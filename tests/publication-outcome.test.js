import assert from "node:assert/strict";
import test from "node:test";
import {
  publicationFailure,
  publicationSuccess,
} from "../src/app/(dashboard)/dashboard/_lib/publication-outcome.js";

test("a database rejection reaches the provider as its reason, not as raw text", () => {
  assert.deepEqual(
    publicationFailure(
      { message: "Publication requirements are incomplete.", code: "P0001" },
      "publish",
    ),
    {
      error: true,
      message:
        "Your page does not meet the publication requirements yet. Check the list above, then try again.",
    },
  );
  assert.deepEqual(
    publicationFailure({ message: "Suspended pages cannot be published." }, "publish"),
    { error: true, message: "Suspended pages cannot be published." },
  );
  assert.deepEqual(
    publicationFailure({ message: "Suspended pages cannot be changed." }, "unpublish"),
    { error: true, message: "Suspended pages cannot be changed." },
  );
});

test("an unexpected failure gets a generic message that names the action", () => {
  assert.deepEqual(
    publicationFailure({ message: 'relation "ceaute.provider_page" does not exist' }, "unpublish"),
    { error: true, message: "Could not unpublish your page. Try again in a moment." },
  );
  assert.equal(publicationFailure(null, "publish").error, true);
});

test("success messages are explicit about the new state", () => {
  assert.deepEqual(publicationSuccess("publish"), {
    error: false,
    message: "Your page is published.",
  });
  assert.deepEqual(publicationSuccess("unpublish"), {
    error: false,
    message: "Your page is unpublished.",
  });
});
