import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPLAY_PHOTO_CONFLICT_MESSAGE,
  clearDisplayPhoto,
  saveDisplayPhoto,
  strayDisplayPhotoPaths,
} from "../src/lib/providers/display-photo-storage.js";

const PAGE_ID = "0b8d6c3e-1d2f-4a5b-9c7d-0e1f2a3b4c5d";
const OLD_PATH = `${PAGE_ID}/11111111-1111-4111-8111-111111111111.jpg`;
const NEW_ID = "22222222-2222-4222-8222-222222222222";
const NEW_PATH = `${PAGE_ID}/${NEW_ID}.png`;
const FILE = { type: "image/png", size: 10 };

// A fake Supabase client holding one provider_page row and the objects in
// the display-photo bucket. `failures` makes a named operation fail, and
// `beforeUpdate` lets a test change the row in between, as a concurrent
// request would.
function fakeSupabase({ path = null, objects = [], failures = {}, beforeUpdate } = {}) {
  const state = { path, objects: new Set(objects), removed: [], updates: 0 };

  const storage = {
    from() {
      return {
        async upload(objectPath) {
          if (failures.upload) return { error: new Error("upload") };
          state.objects.add(objectPath);
          return { error: null };
        },
        async remove(paths) {
          state.removed.push(...paths);
          if (failures.remove) return { error: new Error("remove") };
          for (const objectPath of paths) state.objects.delete(objectPath);
          return { error: null };
        },
        async list(folder) {
          if (failures.list) return { data: null, error: new Error("list") };
          const names = [...state.objects]
            .filter((objectPath) => objectPath.startsWith(`${folder}/`))
            .map((objectPath) => objectPath.slice(folder.length + 1));
          return { data: [...names, ".emptyFolderPlaceholder"].map((name) => ({ name })), error: null };
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
      select() {
        if (patch) {
          return (async () => {
            beforeUpdate?.(state);
            if (failures.update) return { data: null, error: new Error("update") };
            const matches = conditions.every(([column, value]) =>
              column === "id" ? value === PAGE_ID : state.path === value,
            );
            if (!matches) return { data: [], error: null };
            state.path = patch.display_photo_path;
            state.updates += 1;
            return { data: [{ id: PAGE_ID }], error: null };
          })();
        }
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
      async maybeSingle() {
        return { data: { display_photo_path: state.path }, error: null };
      },
    };
    return builder;
  }

  return {
    state,
    storage,
    schema() {
      return { from: table };
    },
  };
}

test("stray paths skip the folder placeholder and the photo in use", () => {
  assert.deepEqual(
    strayDisplayPhotoPaths({
      folder: PAGE_ID,
      names: ["a.jpg", "b.png", ".emptyFolderPlaceholder", ""],
      keepPath: `${PAGE_ID}/a.jpg`,
    }),
    [`${PAGE_ID}/b.png`],
  );
});

test("a first photo is stored and linked", async () => {
  const supabase = fakeSupabase();
  const result = await saveDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: null, file: FILE, photoId: NEW_ID,
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.path, NEW_PATH);
  assert.deepEqual([...supabase.state.objects], [NEW_PATH]);
});

test("a replacement removes the old photo and any leftover files", async () => {
  const leftover = `${PAGE_ID}/33333333-3333-4333-8333-333333333333.webp`;
  const supabase = fakeSupabase({ path: OLD_PATH, objects: [OLD_PATH, leftover] });
  const result = await saveDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: OLD_PATH, file: FILE, photoId: NEW_ID,
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.path, NEW_PATH);
  assert.deepEqual([...supabase.state.objects], [NEW_PATH]);
});

test("a failed upload changes nothing", async () => {
  const supabase = fakeSupabase({ path: OLD_PATH, objects: [OLD_PATH], failures: { upload: true } });
  const result = await saveDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: OLD_PATH, file: FILE, photoId: NEW_ID,
  });

  assert.equal(result.ok, false);
  assert.equal(supabase.state.path, OLD_PATH);
  assert.equal(supabase.state.updates, 0);
  assert.deepEqual([...supabase.state.objects], [OLD_PATH]);
});

test("a failed link removes the new upload and keeps the existing photo", async () => {
  const supabase = fakeSupabase({ path: OLD_PATH, objects: [OLD_PATH], failures: { update: true } });
  const result = await saveDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: OLD_PATH, file: FILE, photoId: NEW_ID,
  });

  assert.equal(result.message, "Could not save your photo.");
  assert.equal(supabase.state.path, OLD_PATH);
  assert.deepEqual([...supabase.state.objects], [OLD_PATH]);
});

test("an overlapping save wins; this one is refused and removes its own upload", async () => {
  const otherPath = `${PAGE_ID}/44444444-4444-4444-8444-444444444444.jpg`;
  const supabase = fakeSupabase({
    path: OLD_PATH,
    objects: [OLD_PATH],
    beforeUpdate(state) {
      // Another tab saved its photo after this request read the page.
      state.objects.add(otherPath);
      state.path = otherPath;
    },
  });
  const result = await saveDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: OLD_PATH, file: FILE, photoId: NEW_ID,
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, DISPLAY_PHOTO_CONFLICT_MESSAGE);
  assert.equal(supabase.state.path, otherPath);
  assert.equal(supabase.state.objects.has(NEW_PATH), false);
  assert.equal(supabase.state.objects.has(otherPath), true);
});

test("a failed cleanup still saves, and the next save collects the leftover", async () => {
  const supabase = fakeSupabase({ path: OLD_PATH, objects: [OLD_PATH], failures: { list: true } });
  const first = await saveDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: OLD_PATH, file: FILE, photoId: NEW_ID,
  });

  assert.equal(first.ok, true);
  assert.equal(supabase.state.objects.has(OLD_PATH), true, "old photo left behind");

  const retry = fakeSupabase({ path: NEW_PATH, objects: [...supabase.state.objects] });
  const second = await clearDisplayPhoto({
    supabase: retry, providerPageId: PAGE_ID, previousPath: NEW_PATH,
  });

  assert.equal(second.ok, true);
  assert.equal(retry.state.path, null);
  assert.deepEqual([...retry.state.objects], []);
});

test("removing the photo clears the page and its files", async () => {
  const supabase = fakeSupabase({ path: OLD_PATH, objects: [OLD_PATH] });
  const result = await clearDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: OLD_PATH,
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.path, null);
  assert.deepEqual([...supabase.state.objects], []);
});

test("removing is refused when the photo changed meanwhile, and nothing is deleted", async () => {
  const otherPath = `${PAGE_ID}/44444444-4444-4444-8444-444444444444.jpg`;
  const supabase = fakeSupabase({
    path: otherPath,
    objects: [otherPath],
  });
  const result = await clearDisplayPhoto({
    supabase, providerPageId: PAGE_ID, previousPath: OLD_PATH,
  });

  assert.equal(result.message, DISPLAY_PHOTO_CONFLICT_MESSAGE);
  assert.equal(supabase.state.path, otherPath);
  assert.deepEqual(supabase.state.removed, []);
});
