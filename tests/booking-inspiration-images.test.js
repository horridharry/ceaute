import assert from "node:assert/strict";
import test from "node:test";
import {
  INSPIRATION_IMAGE_EXTENSIONS,
  INSPIRATION_IMAGE_LIMIT,
  MAX_INSPIRATION_IMAGE_BYTES,
  describeInspirationImageAllowance,
  describeInspirationImageFile,
} from "@/lib/bookings/booking-inspiration-images";

// The limits the customer is told about, the ones the server action applies,
// and the ones the Storage bucket enforces are meant to be the same numbers.
// These are the ones the JavaScript side owns.
function chosenFile({ type = "image/jpeg", size = 1024 } = {}) {
  return { type, size };
}

// The database's CHECK constraint and the Storage bucket both say 10485760, and
// the three have to agree or a file one accepts another rejects with no message
// the customer can act on. This pins the JavaScript side to that number.
test("the limits are the same numbers the database and the bucket enforce", () => {
  assert.equal(MAX_INSPIRATION_IMAGE_BYTES, 10485760);
  assert.equal(INSPIRATION_IMAGE_LIMIT, 5);
  assert.deepEqual(
    [...INSPIRATION_IMAGE_EXTENSIONS.keys()].sort(),
    ["image/jpeg", "image/png", "image/webp"],
  );
});

test("a JPEG within the limits is accepted and keeps its extension", () => {
  const described = describeInspirationImageFile(chosenFile());

  assert.equal(described.error, undefined);
  assert.equal(described.contentType, "image/jpeg");
  assert.equal(described.extension, "jpg");
  assert.equal(described.byteSize, 1024);
});

test("PNG and WebP are accepted with their own extensions", () => {
  assert.equal(
    describeInspirationImageFile(chosenFile({ type: "image/png" })).extension,
    "png",
  );
  assert.equal(
    describeInspirationImageFile(chosenFile({ type: "image/webp" })).extension,
    "webp",
  );
});

test("an image type the bucket would reject is refused first", () => {
  for (const type of ["image/gif", "image/avif", "application/pdf", ""]) {
    assert.equal(
      describeInspirationImageFile(chosenFile({ type })).error,
      "Upload a JPEG, PNG, or WebP image.",
    );
  }
});

test("exactly ten megabytes is accepted and one byte more is not", () => {
  assert.equal(
    describeInspirationImageFile(
      chosenFile({ size: MAX_INSPIRATION_IMAGE_BYTES }),
    ).error,
    undefined,
  );
  assert.equal(
    describeInspirationImageFile(
      chosenFile({ size: MAX_INSPIRATION_IMAGE_BYTES + 1 }),
    ).error,
    "Each image must be 10 MB or smaller.",
  );
});

test("an empty or missing file asks for one rather than uploading nothing", () => {
  assert.equal(
    describeInspirationImageFile(chosenFile({ size: 0 })).error,
    "Choose an image to upload.",
  );
  assert.equal(
    describeInspirationImageFile(null).error,
    "Choose an image to upload.",
  );
  assert.equal(
    describeInspirationImageFile("not-a-file").error,
    "Choose an image to upload.",
  );
});

test("the allowance counts down to the five the database permits", () => {
  const empty = describeInspirationImageAllowance(0);
  assert.equal(empty.limit, INSPIRATION_IMAGE_LIMIT);
  assert.equal(empty.remaining, INSPIRATION_IMAGE_LIMIT);
  assert.equal(empty.isFull, false);

  const partial = describeInspirationImageAllowance(3);
  assert.equal(partial.used, 3);
  assert.equal(partial.remaining, 2);
  assert.equal(partial.isFull, false);

  const full = describeInspirationImageAllowance(INSPIRATION_IMAGE_LIMIT);
  assert.equal(full.remaining, 0);
  assert.equal(full.isFull, true);
});

test("an impossible count never reports a negative allowance", () => {
  assert.equal(describeInspirationImageAllowance(9).remaining, 0);
  assert.equal(describeInspirationImageAllowance(-2).used, 0);
  assert.equal(describeInspirationImageAllowance(undefined).remaining, 5);
});
