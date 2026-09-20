import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { enforceApplicationProfileSession } from "../src/lib/auth/application-session.js";

function createSupabaseStub(profileRows = []) {
  const calls = {
    filters: [],
    signOut: 0,
  };

  return {
    calls,
    client: {
      auth: {
        async signOut() {
          calls.signOut += 1;
          return { error: null };
        },
      },
      schema(schemaName) {
        assert.equal(schemaName, "ceaute");

        return {
          from(tableName) {
            assert.equal(tableName, "profile");

            return {
              select(columns) {
                assert.equal(columns, "id");

                return {
                  eq(column, value) {
                    calls.filters.push({ column, value });

                    return {
                      async maybeSingle() {
                        return {
                          data:
                            profileRows.find(
                              (profile) => profile[column] === value,
                            ) ?? null,
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

test("an authenticated user with an application profile keeps their session", async () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const supabase = createSupabaseStub([{ id: userId }]);

  assert.equal(
    await enforceApplicationProfileSession({
      supabase: supabase.client,
      userId,
    }),
    true,
  );
  assert.equal(supabase.calls.signOut, 0);
});

test("a genuinely new account continues after normal profile bootstrap", async () => {
  const newUserId = "22222222-2222-4222-8222-222222222222";
  const profilesAfterSignupBootstrap = [{ id: newUserId }];
  const supabase = createSupabaseStub(profilesAfterSignupBootstrap);

  assert.equal(
    await enforceApplicationProfileSession({
      supabase: supabase.client,
      userId: newUserId,
    }),
    true,
  );
  assert.equal(supabase.calls.signOut, 0);
});

test("an orphaned authenticated identity is signed out", async () => {
  const staleUserId = "33333333-3333-4333-8333-333333333333";
  const supabase = createSupabaseStub([]);

  assert.equal(
    await enforceApplicationProfileSession({
      supabase: supabase.client,
      userId: staleUserId,
    }),
    false,
  );
  assert.equal(supabase.calls.signOut, 1);
});

test("the same email on another UUID does not recover an orphaned identity", async () => {
  const staleUserId = "44444444-4444-4444-8444-444444444444";
  const currentUserId = "55555555-5555-4555-8555-555555555555";
  const sharedEmail = "provider@example.com";
  const supabase = createSupabaseStub([
    { id: currentUserId, email: sharedEmail },
  ]);

  assert.equal(
    await enforceApplicationProfileSession({
      supabase: supabase.client,
      userId: staleUserId,
    }),
    false,
  );
  assert.deepEqual(supabase.calls.filters, [
    { column: "id", value: staleUserId },
  ]);
  assert.equal(supabase.calls.signOut, 1);
});

test("the request guard rejects an orphan before provider onboarding", () => {
  const proxySource = readFileSync(
    new URL("../src/lib/supabase/proxy.ts", import.meta.url),
    "utf8",
  );
  const orphanBranchStart = proxySource.indexOf("if (!hasApplicationProfile)");
  const providerGuardStart = proxySource.indexOf(
    "if (isDashboardWorkspacePath(pathname) && userId)",
  );

  assert.notEqual(orphanBranchStart, -1);
  assert.ok(orphanBranchStart < providerGuardStart);
  assert.match(
    proxySource.slice(orphanBranchStart, providerGuardStart),
    /return redirectToSignIn\(request, response\)/,
  );
});
