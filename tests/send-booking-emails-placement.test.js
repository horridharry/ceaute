import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Each place that enqueues a booking email schedules an immediate send with
// sendBookingEmailsAfterResponse() (src/lib/emails/send-booking-emails-now.js).
// These checks read the source text and pin where that call sits, so it stays
// after the database write that enqueues the email and before any later step
// that can throw.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEND_CALL = "sendBookingEmailsAfterResponse()";

function readSource(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

// Returns the text of a top-level function, from its declaration to the first
// closing brace at column zero.
function functionBody(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `Expected to find ${declaration}`);
  const end = source.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `Expected ${declaration} to end with a closing brace`);
  return source.slice(start, end + 2);
}

function countOccurrences(text, needle) {
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

test("the payment webhook sends booking emails once the checkout RPC has committed", () => {
  const source = readSource("src/app/api/stripe/payments/route.ts");
  const body = functionBody(source, "async function processCompletedCheckout(");

  assert.equal(countOccurrences(body, SEND_CALL), 1);

  const sendIndex = body.indexOf(SEND_CALL);
  const rpcIndex = body.indexOf("'complete_booking_payment_attempt'");
  const noResultIndex = body.indexOf("if (!result)");
  const refundIndex = body.indexOf("processBookingRefund(");

  assert.notEqual(rpcIndex, -1);
  assert.notEqual(noResultIndex, -1);
  assert.notEqual(refundIndex, -1);
  assert.ok(sendIndex > rpcIndex, "send must follow complete_booking_payment_attempt");
  assert.ok(sendIndex < noResultIndex, "send must precede the no-result check");
  assert.ok(sendIndex < refundIndex, "send must precede processBookingRefund");
});

test("a cancellation sends booking emails once the cancellation RPC has committed", () => {
  const source = readSource("src/lib/bookings/cancel-booking.js");
  const body = functionBody(source, "export async function cancelBookingWithRefund(");

  assert.equal(countOccurrences(body, SEND_CALL), 1);

  const sendIndex = body.indexOf(SEND_CALL);
  const rpcIndex = body.indexOf('"prepare_booking_cancellation"');
  const errorCheckIndex = body.indexOf("if (error)", rpcIndex);
  const normalizeIndex = body.indexOf("normalizeCancellationResult(");
  const refundIndex = body.indexOf("processBookingRefund(");

  assert.notEqual(rpcIndex, -1);
  assert.notEqual(errorCheckIndex, -1);
  assert.notEqual(normalizeIndex, -1);
  assert.notEqual(refundIndex, -1);

  // The send follows the whole error check, not just its opening line.
  const errorCheckEnd = body.indexOf("\n  }\n", errorCheckIndex);
  assert.notEqual(errorCheckEnd, -1);

  assert.ok(sendIndex > rpcIndex, "send must follow prepare_booking_cancellation");
  assert.ok(sendIndex > errorCheckEnd, "send must follow the RPC error check");
  assert.ok(sendIndex < normalizeIndex, "send must precede normalizeCancellationResult");
  assert.ok(sendIndex < refundIndex, "send must precede processBookingRefund");
});
