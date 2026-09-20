import assert from "node:assert/strict";
import test from "node:test";
import { deliverPendingBookingEmails } from "../src/lib/emails/booking-emails.js";

const environment = {
  RESEND_API_KEY: "re_test",
  CEAUTE_EMAIL_FROM: "Ceaute <bookings@example.test>",
  CEAUTE_APP_URL: "https://ceaute.example.test",
};

function outboxEmail(overrides = {}) {
  return {
    id: "email-1",
    claim_token: "claim-1",
    recipient_email: "customer@example.test",
    recipient_role: "customer",
    event_type: "booking_confirmed_customer",
    payload: {
      booking_id: "booking-1",
      customer_booking_path: "/account/bookings/booking-1",
      provider_name: "Glow Studio",
      customer_name: "Casey Customer",
      customer_email: "customer@example.test",
      customer_phone: "+447700900123",
      treatment_name: "Full set",
      selected_add_ons: [{ name: "Nail art" }],
      start_at: "2026-10-20T10:00:00.000Z",
      end_at: "2026-10-20T11:00:00.000Z",
      amount_paid_pence: 5000,
      amount_due_later_pence: 0,
      cancellation_deadline_at: "2026-10-19T10:00:00.000Z",
      address_line_1: "12 Private Street",
      city: "London",
      postcode: "E1 6AN",
      access_instructions: "Ring the top bell",
    },
    ...overrides,
  };
}

// Records every RPC the delivery loop makes so a test can assert on the
// claim, sent and retryable-failure calls in order.
function fakeSupabase(claimedEmails) {
  const calls = [];

  return {
    calls,
    schema(name) {
      assert.equal(name, "ceaute");
      return {
        async rpc(functionName, parameters) {
          calls.push({ functionName, parameters });

          if (functionName === "claim_pending_booking_emails") {
            return { data: claimedEmails, error: null };
          }

          return { data: null, error: null };
        },
      };
    },
  };
}

function fakeFetch(responder) {
  const requests = [];

  return {
    requests,
    async fetchImpl(url, init) {
      const request = { url, init, body: JSON.parse(init.body) };
      requests.push(request);
      return responder(request);
    },
  };
}

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

test("a claimed email is sent once with its outbox id as the idempotency key and then marked sent", async () => {
  const supabase = fakeSupabase([outboxEmail()]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({ id: "resend-message-1" }));

  const result = await deliverPendingBookingEmails({
    limit: 10,
    supabase,
    fetchImpl,
    environment,
  });

  assert.deepEqual(result, { claimed: 1, sent: 1, failed: 0, skipped: 0, configured: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal(requests[0].init.headers["Idempotency-Key"], "email-1");
  assert.equal(requests[0].init.headers.Authorization, "Bearer re_test");
  assert.deepEqual(requests[0].body.to, ["customer@example.test"]);
  assert.equal(requests[0].body.subject, "Your booking is confirmed");
  assert.deepEqual(
    supabase.calls.map((call) => call.functionName),
    ["claim_pending_booking_emails", "record_booking_email_sent"],
  );
  assert.deepEqual(supabase.calls[1].parameters, {
    target_email_id: "email-1",
    target_claim_token: "claim-1",
    target_provider_message_id: "resend-message-1",
  });
});

test("a rejected delivery records a retryable failure with the provider message and does not stop the batch", async () => {
  const supabase = fakeSupabase([
    outboxEmail({ id: "email-1", claim_token: "claim-1" }),
    outboxEmail({ id: "email-2", claim_token: "claim-2" }),
  ]);
  const { fetchImpl } = fakeFetch((request) =>
    request.body.to[0] && request.init.headers["Idempotency-Key"] === "email-1"
      ? { ok: false, status: 429, json: async () => ({ message: "Too many requests" }) }
      : okResponse({ id: "resend-message-2" }),
  );

  const result = await deliverPendingBookingEmails({ supabase, fetchImpl, environment });

  assert.deepEqual(result, { claimed: 2, sent: 1, failed: 1, skipped: 0, configured: true });
  assert.deepEqual(
    supabase.calls.map((call) => call.functionName),
    [
      "claim_pending_booking_emails",
      "record_booking_email_retryable_failure",
      "record_booking_email_sent",
    ],
  );
  assert.deepEqual(supabase.calls[1].parameters, {
    target_email_id: "email-1",
    target_claim_token: "claim-1",
    target_error: "Too many requests",
  });
});

test("a network failure while sending is recorded as retryable rather than lost", async () => {
  const supabase = fakeSupabase([outboxEmail()]);
  const { fetchImpl } = fakeFetch(() => {
    throw new Error("socket hang up");
  });

  const result = await deliverPendingBookingEmails({ supabase, fetchImpl, environment });

  assert.equal(result.failed, 1);
  assert.equal(supabase.calls[1].functionName, "record_booking_email_retryable_failure");
  assert.equal(supabase.calls[1].parameters.target_error, "socket hang up");
});

test("nothing is claimed when email delivery is not configured", async () => {
  const supabase = fakeSupabase([outboxEmail()]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({}));

  const result = await deliverPendingBookingEmails({ supabase, fetchImpl, environment: {} });

  assert.equal(result.configured, false);
  assert.equal(result.claimed, 0);
  assert.equal(supabase.calls.length, 0);
  assert.equal(requests.length, 0);
});

test("a provider confirmation email carries the customer contact details and the exact address", async () => {
  const supabase = fakeSupabase([
    outboxEmail({
      recipient_role: "provider",
      recipient_email: "provider@example.test",
      event_type: "booking_confirmed_provider",
    }),
  ]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({ id: "m" }));

  await deliverPendingBookingEmails({ supabase, fetchImpl, environment });

  const { text, html } = requests[0].body;
  assert.match(text, /Customer email: customer@example.test/);
  assert.match(text, /Customer phone: \+447700900123/);
  assert.match(text, /Address: 12 Private Street, London, E1 6AN/);
  assert.match(text, /Access instructions: Ring the top bell/);
  assert.match(text, /View booking: https:\/\/ceaute.example.test\/dashboard\/bookings\/booking-1/);
  assert.match(html, /12 Private Street/);
});

test("a customer confirmation email links to the customer booking and omits the customer contact lines", async () => {
  const supabase = fakeSupabase([outboxEmail()]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({ id: "m" }));

  await deliverPendingBookingEmails({ supabase, fetchImpl, environment });

  const { text } = requests[0].body;
  assert.doesNotMatch(text, /Customer email:/);
  assert.doesNotMatch(text, /Customer phone:/);
  assert.match(text, /Address: 12 Private Street, London, E1 6AN/);
  assert.match(text, /View booking: https:\/\/ceaute.example.test\/account\/bookings\/booking-1/);
});

test("cancellation emails show refund details and never include the private address", async () => {
  const supabase = fakeSupabase([
    outboxEmail({
      event_type: "customer_cancelled_provider",
      recipient_role: "provider",
      recipient_email: "provider@example.test",
      payload: {
        ...outboxEmail().payload,
        cancelled_by: "customer",
        refund_amount_pence: 4000,
        retained_amount_pence: 1000,
        refund_status: "refund_required",
      },
    }),
  ]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({ id: "m" }));

  await deliverPendingBookingEmails({ supabase, fetchImpl, environment });

  const { text, html, subject } = requests[0].body;
  assert.equal(subject, "A customer cancelled a booking");
  assert.match(text, /Refund amount: £40\.00/);
  assert.match(text, /Retained amount: £10\.00/);
  assert.match(text, /Refund status: Refund pending/);
  assert.doesNotMatch(text, /Address:/);
  assert.doesNotMatch(text, /Access instructions:/);
  assert.doesNotMatch(text, /12 Private Street/);
  assert.doesNotMatch(html, /12 Private Street/);
  assert.doesNotMatch(html, /E1 6AN/);
});

test("email content is HTML-escaped so a customer-supplied name cannot inject markup", async () => {
  const supabase = fakeSupabase([
    outboxEmail({
      recipient_role: "provider",
      event_type: "booking_confirmed_provider",
      payload: { ...outboxEmail().payload, customer_name: "<img src=x onerror=alert(1)>" },
    }),
  ]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({ id: "m" }));

  await deliverPendingBookingEmails({ supabase, fetchImpl, environment });

  assert.doesNotMatch(requests[0].body.html, /<img/);
  assert.match(requests[0].body.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

// The link is built from the payload path and the validated app URL. A
// payload without a path must produce no link at all rather than a URL that
// ends in "/undefined", which the previous implementation could emit.
test("an email whose payload has no booking path shows the link as unavailable rather than a broken URL", async () => {
  const supabase = fakeSupabase([
    outboxEmail({
      payload: { ...outboxEmail().payload, customer_booking_path: undefined },
    }),
  ]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({ id: "m" }));

  await deliverPendingBookingEmails({ supabase, fetchImpl, environment });

  const { text, html } = requests[0].body;
  assert.match(text, /View booking: Unavailable/);
  assert.doesNotMatch(text, /undefined/);
  assert.doesNotMatch(html, /undefined/);
});

test("a booking email sent from Preview uses its canonical application URL", async () => {
  const supabase = fakeSupabase([outboxEmail()]);
  const { requests, fetchImpl } = fakeFetch(() => okResponse({ id: "m" }));

  await deliverPendingBookingEmails({
    supabase,
    fetchImpl,
    environment: {
      ...environment,
      CEAUTE_APP_URL: "https://preview.ceaute.com",
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-abc123.vercel.app",
    },
  });

  const { text, html } = requests[0].body;
  assert.match(
    text,
    /View booking: https:\/\/preview\.ceaute\.com\/account\/bookings\/booking-1/,
  );
  assert.match(html, /https:\/\/preview\.ceaute\.com\/account\/bookings\/booking-1/);
  assert.doesNotMatch(text, /ceaute-abc123\.vercel\.app/);
  assert.doesNotMatch(html, /ceaute-abc123\.vercel\.app/);
});
