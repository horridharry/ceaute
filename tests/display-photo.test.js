import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPLAY_PHOTO_MAX_BYTES,
  detectImageType,
  displayPhotoStoragePath,
  displayPhotoUploadError,
} from "../src/lib/providers/display-photo.js";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);

test("detectImageType reads JPEG, PNG and WebP signatures", () => {
  assert.equal(detectImageType(JPEG), "image/jpeg");
  assert.equal(detectImageType(PNG), "image/png");
  assert.equal(detectImageType(WEBP), "image/webp");
});

test("detectImageType rejects other or truncated content", () => {
  assert.equal(detectImageType(GIF), null);
  assert.equal(detectImageType(JPEG.slice(0, 4)), null);
  assert.equal(detectImageType(undefined), null);
});

test("a matching JPEG, PNG or WebP within 5 MB is accepted", () => {
  assert.equal(displayPhotoUploadError({ type: "image/jpeg", size: 1000, headBytes: JPEG }), null);
  assert.equal(displayPhotoUploadError({ type: "image/png", size: 1000, headBytes: PNG }), null);
  assert.equal(
    displayPhotoUploadError({ type: "image/webp", size: DISPLAY_PHOTO_MAX_BYTES, headBytes: WEBP }),
    null,
  );
});

test("empty, unsupported, oversized and mislabelled files are refused", () => {
  assert.equal(
    displayPhotoUploadError({ type: "image/jpeg", size: 0, headBytes: JPEG }),
    "Choose a photo to upload.",
  );
  assert.equal(
    displayPhotoUploadError({ type: "image/gif", size: 1000, headBytes: GIF }),
    "Upload a JPEG, PNG or WebP image.",
  );
  assert.equal(
    displayPhotoUploadError({ type: "image/png", size: DISPLAY_PHOTO_MAX_BYTES + 1, headBytes: PNG }),
    "Photo must be 5 MB or smaller.",
  );
  assert.equal(
    displayPhotoUploadError({ type: "image/jpeg", size: 1000, headBytes: PNG }),
    "That file is not a valid JPEG, PNG or WebP image.",
  );
});

test("the storage path matches the database's own-folder shape", () => {
  const providerPageId = "0b8d6c3e-1d2f-4a5b-9c7d-0e1f2a3b4c5d";
  const photoId = "11111111-1111-4111-8111-111111111111";
  const path = displayPhotoStoragePath({ providerPageId, photoId, type: "image/webp" });

  assert.equal(path, `${providerPageId}/${photoId}.webp`);
  assert.match(path, /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/);
});
