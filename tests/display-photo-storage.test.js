import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPLAY_PHOTO_CONFLICT_MESSAGE,
  STRAY_MIN_AGE_MS,
  clearDisplayPhoto,
  saveDisplayPhoto,
  strayDisplayPhotoPaths,
} from "../src/lib/providers/display-photo-storage.js";

const PAGE_ID = "0b8d6c3e-1d2f-4a5b-9c7d-0e1f2a3b4c5d";
const NOW = Date.parse("2026-09-22T12:00:00Z");
const pathFor = (id, ext = "jpg") => `${PAGE_ID}/${id}.${ext}`;
const ids = {
  old: "11111111-1111-4111-8111-111111111111",
  a: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  c: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  stray: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};
const JPEG = { type: "image/jpeg", size: 10 };

// One provider_page row and one bucket, shared by every request. Each
// request gets its own client; `hooks` run inside that client's operations
// so a test can let another request run at an exact point, and `failures`
// make an operation of that client fail.
function world({ path = null, objects = {} } = {}) {
  const state = {
    path,
    objects: new Map(Object.entries(objects)),
  };

  function client({ hooks = {}, failures = {} } = {}) {
    const storage = {
      from() {
        return {
          async upload(objectPath) {
            await hooks.beforeUpload?.();
            if (failures.upload) return { error: new Error("upload failed") };
            state.objects.set(objectPath, NOW);
            return { error: null };
          },
          async remove(paths) {
            await hooks.beforeRemove?.(paths);
            if (failures.remove) return { error: new Error("remove failed") };
            for (const objectPath of paths) state.objects.delete(objectPath);
            return { error: null };
          },
          async list(folder) {
            await hooks.beforeList?.();
            if (failures.list) return { data: null, error: new Error("list failed") };
            const listed = [...state.objects]
              .filter(([objectPath]) => objectPath.startsWith(`${folder}/`))
              .map(([objectPath, createdAt]) => ({
                name: objectPath.slice(folder.length + 1),
                created_at: new Date(createdAt).toISOString(),
              }));
            return {
              data: [...listed, { name: ".emptyFolderPlaceholder", created_at: null }],
              error: null,
            };
          },
        };
      },
    };

    function table() {
      let patch = null;
      const conditions = [];
      const builder = {
        update(values) {
          patch = values;
          return builder;
        },
        eq(column, value) {
          conditions.push([column, value]);
          return builder;
        },
        is(column, value) {
          conditions.push([column, value]);
          return builder;
        },
        select() {
          if (!patch) return builder;
          return (async () => {
            await hooks.beforeUpdate?.();
            if (failures.update) return { data: null, error: new Error("update failed") };
            const matches = conditions.every(([column, value]) =>
              column === "id" ? value === PAGE_ID : state.path === value,
            );
            if (!matches) return { data: [], error: null };
            state.path = patch.display_photo_path;
            return { data: [{ id: PAGE_ID }], error: null };
          })();
        },
        async maybeSingle() {
          if (failures.read) return { data: null, error: new Error("read failed") };
          return { data: { display_photo_path: state.path }, error: null };
        },
      };
      return builder;
    }

    return { storage, schema: () => ({ from: table }) };
  }

  return { state, client };
}

const save = (supabase, previousPath, photoId, extra = {}) =>
  saveDisplayPhoto({ supabase, providerPageId: PAGE_ID, previousPath, file: JPEG, photoId, now: NOW, ...extra });
const clear = (supabase, previousPath, extra = {}) =>
  clearDisplayPhoto({ supabase, providerPageId: PAGE_ID, previousPath, now: NOW, ...extra });
const files = (w) => [...w.state.objects.keys()].sort();

// --- stray selection ----------------------------------------------------------

test("only old, unreferenced files are strays", () => {
  const old = new Date(NOW - STRAY_MIN_AGE_MS).toISOString();
  const young = new Date(NOW - STRAY_MIN_AGE_MS + 1000).toISOString();

  assert.deepEqual(
    strayDisplayPhotoPaths({
      folder: PAGE_ID,
      keepPath: pathFor(ids.a),
      now: NOW,
      objects: [
        { name: `${ids.a}.jpg`, created_at: old }, // referenced: kept
        { name: `${ids.b}.jpg`, created_at: old }, // old, unreferenced: stray
        { name: `${ids.c}.jpg`, created_at: young }, // too young: kept
        { name: `${ids.stray}.jpg`, created_at: null }, // no timestamp: kept
        { name: ".emptyFolderPlaceholder", created_at: old },
      ],
    }),
    [pathFor(ids.b)],
  );
});

// --- single requests -------------------------------------------------------------

test("a first photo is stored and linked", async () => {
  const w = world();
  const result = await save(w.client(), null, ids.a);

  assert.equal(result.ok, true);
  assert.equal(w.state.path, pathFor(ids.a));
  assert.deepEqual(files(w), [pathFor(ids.a)]);
});

test("a replacement deletes the photo it replaced", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const result = await save(w.client(), pathFor(ids.old), ids.a);

  assert.equal(result.ok, true);
  assert.equal(w.state.path, pathFor(ids.a));
  assert.deepEqual(files(w), [pathFor(ids.a)]);
});

test("removing clears the page and deletes the photo", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const result = await clear(w.client(), pathFor(ids.old));

  assert.equal(result.ok, true);
  assert.equal(w.state.path, null);
  assert.deepEqual(files(w), []);
});

// --- failures --------------------------------------------------------------------

test("a failed upload changes nothing", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const result = await save(w.client({ failures: { upload: true } }), pathFor(ids.old), ids.a);

  assert.deepEqual([result.ok, result.message], [false, "Could not upload that photo."]);
  assert.equal(w.state.path, pathFor(ids.old));
  assert.deepEqual(files(w), [pathFor(ids.old)]);
});

test("a failed database update deletes only the new upload", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const result = await save(w.client({ failures: { update: true } }), pathFor(ids.old), ids.a);

  assert.deepEqual([result.ok, result.message], [false, "Could not save your photo."]);
  assert.equal(w.state.path, pathFor(ids.old));
  assert.deepEqual(files(w), [pathFor(ids.old)]);
});

test("a failed delete of the replaced photo still saves; the leftover is collected once old", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const first = await save(w.client({ failures: { remove: true } }), pathFor(ids.old), ids.a);

  assert.equal(first.ok, true);
  assert.equal(w.state.path, pathFor(ids.a));
  assert.deepEqual(files(w), [pathFor(ids.a), pathFor(ids.old)].sort(), "leftover kept for now");

  // Too young to sweep an hour later minus a second.
  await clear(w.client(), null, { now: NOW - 5000 + STRAY_MIN_AGE_MS - 1000 });
  assert.equal(w.state.objects.has(pathFor(ids.old)), true);

  // Old enough later on: collected, while the current photo is kept.
  await clear(w.client(), null, { now: NOW + STRAY_MIN_AGE_MS });
  assert.deepEqual(files(w), [pathFor(ids.a)]);
  assert.equal(w.state.path, pathFor(ids.a));
});

test("a failed cleanup listing or current-path read still reports success", async () => {
  for (const failure of ["list", "read"]) {
    const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
    const result = await save(w.client({ failures: { [failure]: true } }), pathFor(ids.old), ids.a);

    assert.equal(result.ok, true, failure);
    assert.equal(w.state.path, pathFor(ids.a), failure);
    assert.deepEqual(files(w), [pathFor(ids.a)], failure);
  }
});

test("a failed removal update keeps the photo", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const result = await clear(w.client({ failures: { update: true } }), pathFor(ids.old));

  assert.deepEqual([result.ok, result.message], [false, "Could not remove your photo."]);
  assert.equal(w.state.path, pathFor(ids.old));
  assert.deepEqual(files(w), [pathFor(ids.old)]);
});

// --- overlapping requests ---------------------------------------------------------

test("two saves from the same photo: the first wins, the second deletes only its own upload", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  let second;
  const first = await save(
    w.client({
      hooks: {
        // The other tab uploads while this one is uploading, and links later.
        async beforeUpdate() {
          second = save(w.client(), pathFor(ids.old), ids.b);
        },
      },
    }),
    pathFor(ids.old),
    ids.a,
  );
  const secondResult = await second;

  assert.equal(first.ok, true);
  assert.deepEqual([secondResult.ok, secondResult.message], [false, DISPLAY_PHOTO_CONFLICT_MESSAGE]);
  assert.equal(w.state.path, pathFor(ids.a));
  assert.deepEqual(files(w), [pathFor(ids.a)]);
});

test("a save that lands during another save's cleanup keeps its photo (the earlier race)", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const result = await save(
    w.client({
      hooks: {
        // After A has linked its photo and is about to sweep, B (which read
        // A's path) uploads and links its own photo.
        async beforeList() {
          const other = await save(w.client(), pathFor(ids.a), ids.b);
          assert.equal(other.ok, true);
        },
      },
    }),
    pathFor(ids.old),
    ids.a,
  );

  assert.equal(result.ok, true);
  assert.equal(w.state.path, pathFor(ids.b), "B's photo is current");
  assert.equal(w.state.objects.has(pathFor(ids.b)), true, "and was not deleted by A");
  assert.deepEqual(files(w), [pathFor(ids.b)]);
});

test("an upload that is not linked yet survives another save's cleanup", async () => {
  const w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  let pending;
  await save(
    w.client({
      hooks: {
        async beforeList() {
          // C has uploaded but not yet linked (its update waits).
          pending = save(
            w.client({ hooks: { beforeUpdate: () => new Promise((resolve) => setTimeout(resolve, 5)) } }),
            pathFor(ids.a),
            ids.c,
          );
          await new Promise((resolve) => setImmediate(resolve));
        },
      },
    }),
    pathFor(ids.old),
    ids.a,
  );

  assert.equal(w.state.objects.has(pathFor(ids.c)), true, "C's upload was not swept");
  const cResult = await pending;
  assert.equal(cResult.ok, true);
  assert.equal(w.state.path, pathFor(ids.c));
  assert.deepEqual(files(w), [pathFor(ids.c)]);
});

test("a removal and a save from the same photo: whichever is second is refused and deletes nothing it does not own", async () => {
  // Save first, then the removal.
  let w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  let removal;
  const saved = await save(
    w.client({ hooks: { async beforeUpdate() { removal = clear(w.client({ hooks: { beforeUpdate: () => new Promise((r) => setTimeout(r, 5)) } }), pathFor(ids.old)); } } }),
    pathFor(ids.old),
    ids.a,
  );
  const removed = await removal;
  assert.equal(saved.ok, true);
  assert.deepEqual([removed.ok, removed.message], [false, DISPLAY_PHOTO_CONFLICT_MESSAGE]);
  assert.equal(w.state.path, pathFor(ids.a));
  assert.deepEqual(files(w), [pathFor(ids.a)]);

  // Removal first, then the save.
  w = world({ path: pathFor(ids.old), objects: { [pathFor(ids.old)]: NOW - 5000 } });
  const cleared = await clear(w.client(), pathFor(ids.old));
  const late = await save(w.client(), pathFor(ids.old), ids.b);
  assert.equal(cleared.ok, true);
  assert.deepEqual([late.ok, late.message], [false, DISPLAY_PHOTO_CONFLICT_MESSAGE]);
  assert.equal(w.state.path, null);
  assert.deepEqual(files(w), []);
});

test("cleanup never deletes the current photo, however old it is", async () => {
  const current = pathFor(ids.a);
  const w = world({
    path: current,
    objects: {
      [current]: NOW - 30 * 24 * 60 * 60 * 1000,
      [pathFor(ids.stray)]: NOW - 2 * STRAY_MIN_AGE_MS,
    },
  });
  const result = await clear(w.client(), null);

  assert.equal(result.ok, true);
  assert.equal(w.state.path, current);
  assert.deepEqual(files(w), [current]);
});
