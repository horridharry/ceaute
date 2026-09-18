import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingEmailSubject,
  renderBookingEmailHtml,
  renderBookingEmailText,
} from "../src/lib/emails/booking-email-content.js";

const APP_URL = "https://ceaute.example.test";
const CUSTOMER_URL = "https://ceaute.example.test/account/bookings/booking-1";
const PROVIDER_URL = "https://ceaute.example.test/dashboard/bookings/booking-1";

const basePayload = {
  booking_id: "booking-1",
  customer_booking_path: "/account/bookings/booking-1",
  provider_name: "Glow Studio",
  customer_name: "Casey Customer",
  customer_email: "customer@example.test",
  customer_phone: "+447700900123",
  treatment_name: "Full set",
  selected_add_ons: [{ name: "Nail art" }, { name: "Gel top coat" }],
  start_at: "2026-10-20T10:00:00.000Z",
  end_at: "2026-10-20T11:00:00.000Z",
  amount_paid_pence: 5000,
  amount_due_later_pence: 2500,
  cancellation_deadline_at: "2026-10-19T10:00:00.000Z",
  address_line_1: "12 Private Street",
  address_line_2: "Flat 3",
  city: "London",
  postcode: "E1 6AN",
  access_instructions: "Ring the top bell",
};

const cancellationPayload = {
  ...basePayload,
  cancelled_by: "customer",
  refund_amount_pence: 4000,
  retained_amount_pence: 1000,
  refund_status: "refund_required",
};

const EVENTS = [
  { eventType: "booking_confirmed_customer", role: "customer", title: "Your booking is confirmed", cancellation: false },
  { eventType: "booking_confirmed_provider", role: "provider", title: "New booking confirmed", cancellation: false },
  { eventType: "customer_cancelled_customer", role: "customer", title: "Your booking was cancelled", cancellation: true },
  { eventType: "customer_cancelled_provider", role: "provider", title: "A customer cancelled a booking", cancellation: true },
  { eventType: "provider_cancelled_customer", role: "customer", title: "Your provider cancelled a booking", cancellation: true },
  { eventType: "provider_cancelled_provider", role: "provider", title: "You cancelled a booking", cancellation: true },
];

function emailFor({ eventType, role, cancellation }, payloadOverrides = {}) {
  return {
    id: "email-1",
    event_type: eventType,
    recipient_role: role,
    payload: {
      ...(cancellation ? cancellationPayload : basePayload),
      ...payloadOverrides,
    },
  };
}

// The visible text of the HTML alternative: tags dropped, entities decoded.
function visibleText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ");
}

function hrefs(html) {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

for (const event of EVENTS) {
  test(`${event.eventType}: subject, heading and shared booking details appear in both alternatives`, () => {
    const email = emailFor(event);
    const text = renderBookingEmailText(email, APP_URL);
    const html = renderBookingEmailHtml(email, APP_URL);
    const visible = visibleText(html);

    assert.equal(bookingEmailSubject(email), event.title);
    assert.equal(text.split("\n")[0], event.title);
    assert.match(html, new RegExp(`<h1[^>]*>${event.title}</h1>`));

    for (const expected of [
      "Glow Studio",
      "Casey Customer",
      "Full set",
      "Nail art, Gel top coat",
      "£50.00",
      "£25.00",
    ]) {
      assert.ok(text.includes(expected), `text is missing ${expected}`);
      assert.ok(visible.includes(expected), `html is missing ${expected}`);
    }

    // Every "Label: value" fact in the text alternative is also in the HTML.
    for (const entry of text.split("\n").slice(2)) {
      const [label, ...rest] = entry.split(": ");
      const value = rest.join(": ");

      if (label === "View booking" || label === "Find another time") {
        continue;
      }

      assert.ok(visible.includes(label), `html is missing the label ${label}`);
      assert.ok(visible.includes(value), `html is missing the value ${value}`);
    }
  });

  test(`${event.eventType}: the recipient sees only the details meant for their role`, () => {
    const email = emailFor(event);
    const text = renderBookingEmailText(email, APP_URL);
    const html = renderBookingEmailHtml(email, APP_URL);
    const expectedUrl = event.role === "provider" ? PROVIDER_URL : CUSTOMER_URL;
    const otherUrl = event.role === "provider" ? CUSTOMER_URL : PROVIDER_URL;

    if (event.role === "provider") {
      assert.match(text, /Customer email: customer@example\.test/);
      assert.match(text, /Customer phone: \+447700900123/);
      assert.match(html, /customer@example\.test/);
      assert.match(html, /\+447700900123/);
    } else {
      assert.doesNotMatch(text, /Customer email|Customer phone/);
      assert.doesNotMatch(html, /Customer email|Customer phone/);
      assert.doesNotMatch(html, /customer@example\.test/);
      assert.doesNotMatch(html, /\+447700900123/);
    }

    // B5: a customer whose provider cancelled is offered a way forward.
    const expectedLabel =
      event.eventType === "provider_cancelled_customer"
        ? "Find another time"
        : "View booking";

    assert.ok(text.endsWith(`${expectedLabel}: ${expectedUrl}`));
    assert.ok(hrefs(html).length > 0);
    assert.deepEqual([...new Set(hrefs(html))], [expectedUrl]);
    assert.ok(!html.includes(otherUrl));
  });

  test(`${event.eventType}: ${event.cancellation ? "shows refund details and hides the private address" : "shows the address, access instructions and cancellation deadline"}`, () => {
    const email = emailFor(event);
    const text = renderBookingEmailText(email, APP_URL);
    const html = renderBookingEmailHtml(email, APP_URL);
    const visible = visibleText(html);

    if (event.cancellation) {
      assert.match(text, /Cancelled by: customer/);
      assert.match(text, /Refund amount: £40\.00/);
      assert.match(text, /Retained amount: £10\.00/);
      assert.match(text, /Refund status: Refund pending/);
      assert.match(visible, /Booking cancelled/);
      assert.match(visible, /Refund amount\s+£40\.00/);
      assert.match(visible, /Retained amount\s+£10\.00/);
      assert.match(visible, /Refund status\s+Refund pending/);

      for (const alternative of [text, html]) {
        assert.doesNotMatch(alternative, /12 Private Street|Flat 3|E1 6AN/);
        assert.doesNotMatch(alternative, /Ring the top bell/);
        assert.doesNotMatch(alternative, /Access instructions|Cancellation deadline/);
        assert.doesNotMatch(alternative, /Booking confirmed/);
      }
    } else {
      assert.match(text, /Cancellation deadline: .*19 Oct/);
      assert.match(visible, /Booking confirmed/);
      assert.match(visible, /Cancellation deadline\s+\S.*19 Oct/);

      if (event.role === "provider") {
        // B4: the provider is not told her own street, and her payment rows
        // read from her side.
        for (const alternative of [text, visible]) {
          assert.doesNotMatch(alternative, /12 Private Street|Flat 3|E1 6AN/);
          assert.doesNotMatch(alternative, /Ring the top bell/);
        }
        assert.match(text, /Paid to your Stripe: £50\.00/);
        assert.match(text, /Collect on the day: £25\.00/);
      } else {
        assert.match(text, /Address: 12 Private Street, Flat 3, London, E1 6AN/);
        assert.match(text, /Access instructions: Ring the top bell/);
        assert.match(visible, /Address\s+12 Private Street, Flat 3, London, E1 6AN/);
        assert.match(visible, /Access instructions\s+Ring the top bell/);
        assert.match(text, /Amount paid: £50\.00/);
      }

      for (const alternative of [text, html]) {
        assert.doesNotMatch(alternative, /Refund|Retained|Cancelled by/);
      }
    }
  });
}

test("confirmations and cancellations share one layout but use different accents", () => {
  const confirmation = renderBookingEmailHtml(emailFor(EVENTS[0]), APP_URL);
  const cancellation = renderBookingEmailHtml(emailFor(EVENTS[2]), APP_URL);

  for (const html of [confirmation, cancellation]) {
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/);
    assert.match(html, /max-width:600px/);
    assert.match(html, />ceaute</);
    assert.doesNotMatch(html, /<script|<link|class="[^"]*\b(flex|grid)\b/);
  }

  assert.match(confirmation, /bgcolor="#9d174d"/);
  assert.doesNotMatch(confirmation, /bgcolor="#334155"/);
  assert.match(cancellation, /bgcolor="#334155"/);
});

test("each refund status is labelled for the reader", () => {
  const labels = {
    refunded: "Refund recorded",
    refund_failed: "Refund failed",
    refund_required: "Refund pending",
    something_else: "Refund status unavailable",
  };

  for (const [status, label] of Object.entries(labels)) {
    const email = emailFor(EVENTS[2], { refund_status: status });

    assert.match(renderBookingEmailText(email, APP_URL), new RegExp(`Refund status: ${label}`));
    assert.ok(visibleText(renderBookingEmailHtml(email, APP_URL)).includes(label));
  }
});

test("missing optional details fall back to readable placeholders", () => {
  const email = emailFor(EVENTS[0], {
    selected_add_ons: [],
    access_instructions: null,
    address_line_1: null,
    address_line_2: null,
    city: null,
    postcode: null,
  });
  const text = renderBookingEmailText(email, APP_URL);

  assert.match(text, /Add-ons: None/);
  assert.match(text, /Address: Unavailable/);
  assert.match(text, /Access instructions: Unavailable/);
  assert.doesNotMatch(renderBookingEmailHtml(email, APP_URL), /undefined|null/);
});

test("every dynamic field is HTML-escaped", () => {
  const attack = `<script>alert("x")</script>'&`;
  const escaped = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#039;&amp;";
  const fields = [
    "provider_name",
    "customer_name",
    "customer_email",
    "customer_phone",
    "treatment_name",
    "address_line_1",
    "address_line_2",
    "city",
    "postcode",
    "access_instructions",
  ];

  for (const field of fields) {
    // EVENTS[0] is the customer confirmation, the one email that carries every
    // field in this list — a provider confirmation has no address panel.
    const event = ["customer_email", "customer_phone"].includes(field)
      ? EVENTS[1]
      : EVENTS[0];
    const html = renderBookingEmailHtml(emailFor(event, { [field]: attack }), APP_URL);

    assert.doesNotMatch(html, /<script/, `${field} injected markup`);
    assert.ok(html.includes(escaped), `${field} was not escaped`);
  }

  const addOnHtml = renderBookingEmailHtml(
    emailFor(EVENTS[1], { selected_add_ons: [{ name: attack }] }),
    APP_URL,
  );
  assert.doesNotMatch(addOnHtml, /<script/);
  assert.ok(addOnHtml.includes(escaped));

  const cancelledByHtml = renderBookingEmailHtml(
    emailFor(EVENTS[3], { cancelled_by: attack }),
    APP_URL,
  );
  assert.doesNotMatch(cancelledByHtml, /<script/);
  assert.ok(cancelledByHtml.includes(escaped));
});

test("line breaks in access instructions survive as <br /> without allowing markup", () => {
  const html = renderBookingEmailHtml(
    emailFor(EVENTS[0], { access_instructions: "Gate code 12\n<b>Top</b> bell" }),
    APP_URL,
  );

  assert.ok(html.includes("Gate code 12<br />&lt;b&gt;Top&lt;/b&gt; bell"));
});

test("a booking path that leaves the Ceaute origin or the web produces no link", () => {
  const unsafePaths = [
    "//evil.example/phish",
    "\\\\evil.example/phish",
    "https://evil.example/phish",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "",
    undefined,
    42,
  ];

  for (const path of unsafePaths) {
    const email = emailFor(EVENTS[0], { customer_booking_path: path });
    const text = renderBookingEmailText(email, APP_URL);
    const html = renderBookingEmailHtml(email, APP_URL);

    assert.ok(text.endsWith("View booking: Unavailable"), `text linked ${String(path)}`);
    assert.deepEqual(hrefs(html), [], `html linked ${String(path)}`);
    assert.doesNotMatch(html, /evil\.example|javascript:|View booking|undefined/);
  }
});

test("a provider email without a booking id has no link rather than one ending in /undefined", () => {
  const email = emailFor(EVENTS[1], { booking_id: undefined });

  assert.ok(renderBookingEmailText(email, APP_URL).endsWith("View booking: Unavailable"));
  assert.deepEqual(hrefs(renderBookingEmailHtml(email, APP_URL)), []);
});

test("a booking id cannot climb out of the dashboard path or break the href attribute", () => {
  const email = emailFor(EVENTS[1], { booking_id: '../../admin"><img src=x>' });
  const html = renderBookingEmailHtml(email, APP_URL);
  const links = [...new Set(hrefs(html))];

  assert.equal(links.length, 1);
  assert.ok(links[0].startsWith("https://ceaute.example.test/dashboard/bookings/"));
  assert.doesNotMatch(links[0], /\.\.\/|admin"/);
  assert.doesNotMatch(html, /<img/);
});

test("an unknown event type still renders with the generic subject", () => {
  const email = emailFor({ eventType: "something_new", role: "customer", cancellation: false });

  assert.equal(bookingEmailSubject(email), "Ceaute booking update");
  assert.match(renderBookingEmailHtml(email, APP_URL), /<h1[^>]*>Ceaute booking update<\/h1>/);
});
