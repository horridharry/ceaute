import assert from "node:assert/strict";
import test from "node:test";
import { loadProviderBookingGroups } from "../src/lib/bookings/provider-booking-groups.js";

// getLatestPaymentAttemptsForBookings only reaches the privileged
// service-role client when there are booking ids to look up, so an empty
// rpc result exercises this module without needing to inject a Supabase
// client for that dependency too.
function fakeSupabase({ data = [], error = null } = {}) {
  const calls = [];

  return {
    calls,
    schema(name) {
      assert.equal(name, "ceaute");
      return {
        async rpc(functionName, parameters) {
          calls.push({ functionName, parameters });
          return { data, error };
        },
      };
    },
  };
}

test("loadProviderBookingGroups calls get_provider_booking_summaries with no arguments", async () => {
  const supabase = fakeSupabase({ data: [] });

  await loadProviderBookingGroups(supabase);

  assert.deepEqual(supabase.calls, [
    { functionName: "get_provider_booking_summaries", parameters: undefined },
  ]);
});

test("loadProviderBookingGroups groups an empty booking list into empty timing buckets", async () => {
  const supabase = fakeSupabase({ data: [] });

  const groups = await loadProviderBookingGroups(supabase);

  assert.deepEqual(groups, { upcoming: [], previous: [], cancelled: [] });
});

test("loadProviderBookingGroups throws when the rpc call fails", async () => {
  const supabase = fakeSupabase({ data: null, error: { message: "boom" } });

  await assert.rejects(
    () => loadProviderBookingGroups(supabase),
    /Could not load bookings\./,
  );
});
