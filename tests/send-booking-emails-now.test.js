import assert from "node:assert/strict";
import test from "node:test";
import { sendBookingEmailsAfterResponse } from "../src/lib/emails/send-booking-emails-now.js";

test("schedules exactly one pass that calls deliver() with no arguments", async (t) => {
  t.mock.method(console, "error", () => {});
  const scheduled = [];
  const deliverCalls = [];

  sendBookingEmailsAfterResponse({
    schedule: (callback) => scheduled.push(callback),
    deliver: async (...args) => {
      deliverCalls.push(args);
    },
  });

  assert.equal(scheduled.length, 1);
  assert.equal(typeof scheduled[0], "function");
  assert.equal(deliverCalls.length, 0);

  await scheduled[0]();

  assert.equal(deliverCalls.length, 1);
  assert.deepEqual(deliverCalls[0], []);
});

test("swallows a rejected delivery", async (t) => {
  t.mock.method(console, "error", () => {});
  const scheduled = [];

  sendBookingEmailsAfterResponse({
    schedule: (callback) => scheduled.push(callback),
    deliver: async () => {
      throw new Error("Resend is unavailable.");
    },
  });

  assert.equal(scheduled.length, 1);
  await assert.doesNotReject(scheduled[0]());
});

test("swallows a synchronous schedule error", (t) => {
  t.mock.method(console, "error", () => {});

  assert.doesNotThrow(() =>
    sendBookingEmailsAfterResponse({
      schedule: () => {
        throw new Error("`after` was called outside a request scope.");
      },
      deliver: async () => {},
    }),
  );
});

test("the default after() outside a request scope does not throw", (t) => {
  t.mock.method(console, "error", () => {});

  assert.doesNotThrow(() => sendBookingEmailsAfterResponse());
});
