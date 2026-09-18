import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingEmailSubject,
  buildBookingEmailContent,
  renderBookingEmailHtml,
  renderBookingEmailText,
} from "../src/lib/emails/booking-email-content.js";

const APP_URL = "https://ceaute.example.test";
const CUSTOMER_URL = "https://ceaute.example.test/account/bookings/booking-1";
const PROVIDER_URL = "https://ceaute.example.test/dashboard/bookings/booking-1";
const DIARY_URL = "https://ceaute.example.test/dashboard/bookings";

const basePayload = {
  booking_id: "booking-1",
  customer_booking_path: "/account/bookings/booking-1",
  provider_name: "Glow Studio",
  provider_username: "glowstudio",
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
  cancelled_at: "2026-10-12T09:00:00.000Z",
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
    .replaceAll("&#8203;", "")
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

function ceauteHrefs(html) {
  return hrefs(html).filter((href) => href.startsWith(APP_URL));
}

// The action lines are the only text lines whose value is a URL; every other
// line must appear verbatim in the rendered HTML.
function factLines(text) {
  return text
    .split("\n")
    .slice(2)
    .filter((line) => line && !/^[^:]+: https?:\/\//.test(line));
}

for (const event of EVENTS) {
  test(`${event.eventType}: the subject is fixed and every text fact is in the HTML`, () => {
    const email = emailFor(event);
    const text = renderBookingEmailText(email, APP_URL);
    const visible = visibleText(renderBookingEmailHtml(email, APP_URL));

    assert.equal(bookingEmailSubject(email), event.title);
    assert.equal(text.split("\n")[0], event.title);

    for (const line of factLines(text)) {
      assert.ok(visible.includes(line), `html is missing the line: ${line}`);
    }
  });

  test(`${event.eventType}: the recipient sees only the details meant for their role`, () => {
    const email = emailFor(event);
    const text = renderBookingEmailText(email, APP_URL);
    const html = renderBookingEmailHtml(email, APP_URL);
    const expectedUrl = event.role === "provider" ? PROVIDER_URL : CUSTOMER_URL;
    const otherUrl = event.role === "provider" ? CUSTOMER_URL : PROVIDER_URL;

    if (event.role === "provider") {
      // Every provider email carries the customer's phone. Only the
      // confirmation carries her email address: the cancellation templates
      // deliberately reduce it to a name and a number.
      assert.match(text, /\+447700900123/);

      if (!event.cancellation) {
        assert.match(text, /customer@example\.test/);
        assert.match(html, /customer@example\.test/);
      }
    } else {
      assert.doesNotMatch(text, /customer@example\.test/);
      assert.doesNotMatch(text, /\+447700900123/);
      assert.doesNotMatch(html, /customer@example\.test/);
      assert.doesNotMatch(html, /\+447700900123/);
    }

    // The booking link always points at the recipient's own view of it, and the
    // other role's URL never appears.
    assert.ok(!html.includes(otherUrl), `linked the other role's booking view`);

    // provider_cancelled_customer is the one email that leads elsewhere: a
    // customer whose provider cancelled needs a way forward, not a way back.
    if (event.eventType === "provider_cancelled_customer") {
      assert.ok(hrefs(html).includes(`${APP_URL}/discover`));
      assert.match(text, /^Find another time: /m);
    }

    if (event.role === "provider") {
      assert.ok(hrefs(html).includes(DIARY_URL), "provider emails link to the diary");
    } else {
      assert.ok(!hrefs(html).includes(DIARY_URL), "customer emails never link to the diary");
    }

    assert.ok(ceauteHrefs(html).includes(expectedUrl));
  });

  test(`${event.eventType}: ${event.cancellation ? "carries refund facts and no private address" : "carries the money lines and the deadline"}`, () => {
    const email = emailFor(event);
    const text = renderBookingEmailText(email, APP_URL);
    const html = renderBookingEmailHtml(email, APP_URL);
    const visible = visibleText(html);

    if (event.cancellation) {
      // The private address is deliberately absent from every cancellation.
      for (const alternative of [text, html]) {
        assert.doesNotMatch(alternative, /12 Private Street|Flat 3|E1 6AN/);
        assert.doesNotMatch(alternative, /Ring the top bell/);
      }
      assert.doesNotMatch(html, /maps\.google|google\.com\/maps/);
      // Amounts, never percentages.
      assert.doesNotMatch(visible, /\d\s?%/);
      assert.match(visible, /£/);
    } else {
      assert.match(visible, /Full set with Nail art, Gel top coat\./);
      assert.match(text, /19 Oct/);

      if (event.role === "provider") {
        // B4: she is not told her own street; her money reads from her side.
        for (const alternative of [text, visible]) {
          assert.doesNotMatch(alternative, /12 Private Street|Flat 3|E1 6AN/);
          assert.doesNotMatch(alternative, /Ring the top bell/);
        }
        assert.match(text, /£50\.00 is in your Stripe\. Collect £25\.00 on the day\./);
        assert.doesNotMatch(html, /google\.com\/maps/);
      } else {
        assert.match(text, /12 Private Street, Flat 3, London, E1 6AN/);
        assert.match(text, /Ring the top bell/);
        assert.match(text, /£50\.00 paid\. £25\.00 due on the day\./);
        assert.ok(
          hrefs(html).some((href) => href.startsWith("https://www.google.com/maps/search/")),
          "the customer confirmation offers directions",
        );
      }
    }
  });
}

test("every email is built on the approved shell: light only, 600px, one breakpoint, no scripts", () => {
  for (const event of EVENTS) {
    const html = renderBookingEmailHtml(emailFor(event), APP_URL);

    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<meta name="color-scheme" content="light only">/);
    assert.match(html, /<meta name="supported-color-schemes" content="light only">/);
    assert.match(html, /width="600"/);
    assert.match(html, /@media \(max-width:620px\)/);
    assert.match(html, />ceaute</);
    assert.match(html, /background:#f0eee9/);
    assert.match(html, /You are receiving this email because of a booking made through Ceaute\./);
    assert.doesNotMatch(html, /<script|<link rel="stylesheet"/);
    // The old pink palette is gone.
    assert.doesNotMatch(html, /#9d174d|#fdf2f8|#fbcfe8|#f7edf1/i);
  }
});

test("headlines follow the approved copy for each event", () => {
  const headlineOf = (event, overrides) =>
    buildBookingEmailContent(emailFor(event, overrides), APP_URL).blocks[0].text;

  assert.equal(headlineOf(EVENTS[0]), "Casey, you’re booked with Glow Studio.");
  assert.equal(headlineOf(EVENTS[1]), "Casey booked Full set for Tuesday at 11:00 am.");
  assert.equal(headlineOf(EVENTS[4]), "Glow Studio cancelled your Tuesday appointment.");
  assert.equal(headlineOf(EVENTS[5]), "You cancelled Tuesday with Casey.");
});

test("a customer cancellation reads differently when the provider retains something", () => {
  const fullRefund = emailFor(EVENTS[2], {
    refund_amount_pence: 5000,
    retained_amount_pence: 0,
  });
  const retained = emailFor(EVENTS[2], {
    refund_amount_pence: 4000,
    retained_amount_pence: 1000,
  });

  assert.match(
    renderBookingEmailText(fullRefund, APP_URL),
    /Your £50\.00 is on its way back to your card\./,
  );
  assert.match(
    renderBookingEmailText(retained, APP_URL),
    /Glow Studio keeps £10\.00 of your £50\.00\./,
  );

  // Neither states a percentage.
  for (const email of [fullRefund, retained]) {
    assert.doesNotMatch(visibleText(renderBookingEmailHtml(email, APP_URL)), /\d\s?%/);
  }
});

test("the provider's view of a customer cancellation matches what was actually kept", () => {
  const keptEverything = renderBookingEmailText(
    emailFor(EVENTS[3], { refund_amount_pence: 0, retained_amount_pence: 5000 }),
    APP_URL,
  );
  const keptSome = renderBookingEmailText(
    emailFor(EVENTS[3], { refund_amount_pence: 4000, retained_amount_pence: 1000 }),
    APP_URL,
  );
  const keptNothing = renderBookingEmailText(
    emailFor(EVENTS[3], { refund_amount_pence: 5000, retained_amount_pence: 0 }),
    APP_URL,
  );

  assert.match(keptEverything, /You keep the £50\.00\./);
  assert.match(keptEverything, /nothing is refunded/);
  assert.match(keptSome, /£10\.00 stays with you and £40\.00 goes back/);
  assert.match(keptNothing, /Casey cancelled Tuesday\./);
  assert.match(keptNothing, /£50\.00 goes back to their card/);
});

test("the refund status block has a dot and a word for each state", () => {
  const states = [
    [{ refund_amount_pence: 4000, refund_status: "refund_required" }, "#c98a1a", "Refund processing with Stripe"],
    [{ refund_amount_pence: 4000, refund_status: "refund_failed" }, "#b3261e", "The first refund attempt failed. Ceaute is retrying it."],
    [{ refund_amount_pence: 4000, refund_status: "refunded" }, "#2f6f4f", "Refund settled"],
    [{ refund_amount_pence: 0, retained_amount_pence: 5000, refund_status: "refunded" }, "#2f6f4f", "Settled — no refund due"],
  ];

  for (const [overrides, dot, title] of states) {
    const email = emailFor(EVENTS[2], overrides);
    const html = renderBookingEmailHtml(email, APP_URL);

    assert.ok(html.includes(`background:${dot}`), `${title} is missing its ${dot} dot`);
    assert.ok(visibleText(html).includes(title), `${title} is missing from the HTML`);
    assert.ok(renderBookingEmailText(email, APP_URL).includes(title), `${title} is missing from the text`);
    // A dot and a word, never a filled or tinted status box.
    assert.doesNotMatch(html, new RegExp(`background-color:${dot}`, "i"));
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
  const html = renderBookingEmailHtml(email, APP_URL);

  assert.match(text, /^Full set\.$/m);
  assert.match(text, /^Unavailable$/m);
  assert.doesNotMatch(html, /undefined|null/);
  // With no address there is nothing to give directions to.
  assert.ok(!hrefs(html).some((href) => href.includes("google.com/maps")));
});

test("every dynamic field is HTML-escaped", () => {
  const attack = `<script>alert("x")</script>'&`;
  const escaped = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#039;&amp;";
  const fields = [
    "provider_name",
    "customer_name",
    "treatment_name",
    "address_line_1",
    "address_line_2",
    "city",
    "postcode",
    "access_instructions",
  ];

  for (const field of fields) {
    const html = renderBookingEmailHtml(emailFor(EVENTS[0], { [field]: attack }), APP_URL);

    assert.doesNotMatch(html, /<script/, `${field} injected markup`);
    assert.ok(html.includes(escaped), `${field} was not escaped`);
  }

  // The contact details only exist on a provider email.
  for (const field of ["customer_email", "customer_phone"]) {
    const html = renderBookingEmailHtml(emailFor(EVENTS[1], { [field]: attack }), APP_URL);
    assert.doesNotMatch(html, /<script/, `${field} injected markup`);
  }

  const addOnHtml = renderBookingEmailHtml(
    emailFor(EVENTS[1], { selected_add_ons: [{ name: attack }] }),
    APP_URL,
  );
  assert.doesNotMatch(addOnHtml, /<script/);
  assert.ok(addOnHtml.includes(escaped));
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

    assert.doesNotMatch(text, /^View booking: /m, `text linked ${String(path)}`);
    assert.deepEqual(ceauteHrefs(html), [], `html linked ${String(path)}`);
    assert.doesNotMatch(html, /evil\.example|javascript:|undefined/);
  }
});

test("a provider email without a booking id has no link rather than one ending in /undefined", () => {
  const email = emailFor(EVENTS[1], { booking_id: undefined });
  const html = renderBookingEmailHtml(email, APP_URL);

  assert.doesNotMatch(renderBookingEmailText(email, APP_URL), /^Open booking: /m);
  assert.ok(!html.includes(`${APP_URL}/dashboard/bookings/`));
  assert.doesNotMatch(html, /undefined/);
});

test("a booking id cannot climb out of the dashboard path or break the href attribute", () => {
  const email = emailFor(EVENTS[1], { booking_id: '../../admin"><img src=x>' });
  const html = renderBookingEmailHtml(email, APP_URL);
  // The button and the footer both point at the booking, so dedupe first.
  const bookingLinks = [
    ...new Set(ceauteHrefs(html).filter((href) => href.includes("/dashboard/bookings/"))),
  ];

  assert.equal(bookingLinks.length, 1);
  assert.ok(bookingLinks[0].startsWith(`${APP_URL}/dashboard/bookings/`));
  assert.doesNotMatch(bookingLinks[0], /\.\.\/|admin"/);
  assert.doesNotMatch(html, /<img/);
});

test("a provider username cannot break out of the profile link", () => {
  const email = emailFor(EVENTS[2], { provider_username: '../admin"><img src=x>' });
  const html = renderBookingEmailHtml(email, APP_URL);

  assert.doesNotMatch(html, /<img/);
  for (const href of ceauteHrefs(html)) {
    assert.doesNotMatch(href, /\.\.\/|admin"/);
  }
});

test("an unknown event type still renders with the generic subject", () => {
  const email = emailFor({ eventType: "something_new", role: "customer", cancellation: false });
  const html = renderBookingEmailHtml(email, APP_URL);

  assert.equal(bookingEmailSubject(email), "Ceaute booking update");
  assert.ok(visibleText(html).includes("Ceaute booking update"));
});
