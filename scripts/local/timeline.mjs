// One booking's history on the LOCAL stack, in time order: the hold, Checkout
// attempts, Stripe events, confirmation, cancellation, refunds and emails. It
// ends with checks that the records agree with each other and, with --stripe,
// with Stripe. This is the evidence for a booking journey; a confirmation
// screen is not (docs/verification.md, "Local agent runs").
//
//   npm run local:timeline -- latest
//   npm run local:timeline -- <booking-id> --stripe
//
// Read-only. Exits 1 when a check disagrees.
import { fail, localEnv, localStack, psql } from "./stack.mjs";

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith("--")) ?? "latest";
const withStripe = args.includes("--stripe");
if (target !== "latest" && !/^[0-9a-f-]{36}$/i.test(target)) fail("Usage: npm run local:timeline -- latest|<booking-id> [--stripe]");

const stack = localStack();
const q = (sql) => psql(stack, sql).trim();
const json = (sql) => JSON.parse(q(`select coalesce(json_agg(r), '[]') from (${sql}) r;`));

const bookingId = target === "latest" ? q("select id from ceaute.booking order by created_at desc limit 1;") : target;
if (!bookingId) fail("No bookings on the local database yet.");

const [booking] = json(`
  select b.*, p.username, u.email as customer_email, coalesce(b.service_snapshot->>'treatment_name', b.service_snapshot->>'name') as treatment
  from ceaute.booking b
  join ceaute.provider_page p on p.id = b.provider_page_id
  join auth.users u on u.id = b.customer_profile_id
  where b.id = '${bookingId}'`);
if (!booking) fail(`No booking ${bookingId} on the local database.`);

const attempts = json(`select * from ceaute.booking_payment_attempt where booking_id = '${bookingId}' order by attempt_number`);
const refunds = json(`select * from ceaute.booking_refund_operation where booking_id = '${bookingId}' order by created_at`);
const events = json(`
  select e.* from ceaute.stripe_payment_event e
  where e.booking_payment_attempt_id in (select id from ceaute.booking_payment_attempt where booking_id = '${bookingId}')
     or e.stripe_payment_intent_id in (select stripe_payment_intent_id from ceaute.booking_payment_attempt where booking_id = '${bookingId}')
  order by e.received_at`);
const emails = json(`select * from ceaute.booking_email_outbox where booking_id = '${bookingId}' order by created_at`);
const others = json(`
  select created_at, 'dispute' as kind, row_to_json(d)::text as detail from ceaute.booking_dispute d where booking_id = '${bookingId}'
  union all
  select created_at, 'provider liability', row_to_json(l)::text from ceaute.provider_liability l where booking_id = '${bookingId}'
  union all
  select created_at, 'review', 'rating ' || coalesce(to_jsonb(r)->>'rating', '?') from ceaute.booking_review r where booking_id = '${bookingId}'`);

const pounds = (pence) => (pence === null || pence === undefined ? "—" : `£${(Number(pence) / 100).toFixed(2)}`);
const rows = [];
const add = (at, source, text) => at && rows.push({ at: new Date(at), source, text });

add(booking.created_at, "booking", `hold created for ${booking.start_at} (holds until ${booking.expires_at ?? "—"})`);
add(booking.confirmed_at, "booking", "confirmed");
add(booking.cancelled_at, "booking", `cancelled by ${booking.cancelled_by}: refund ${pounds(booking.cancellation_refund_pence)}, retained ${pounds(booking.cancellation_retained_pence)}`);
for (const a of attempts) {
  const n = `attempt ${a.attempt_number}`;
  add(a.created_at, "payment", `${n} created: charge ${pounds(a.amount_charged_pence)} of ${pounds(a.total_booking_value_pence)}, ${pounds(a.amount_due_later_pence)} due later (now ${a.payment_status})`);
  add(a.checkout_claimed_at, "payment", `${n} Checkout claimed`);
  add(a.checkout_creation_uncertain_at, "payment", `${n} Checkout creation uncertain`);
  add(a.refund_requested_at, "payment", `${n} refund requested`);
  add(a.refunded_at, "payment", `${n} refunded ${pounds(a.refund_amount_pence)}`);
  add(a.refund_failed_at, "payment", `${n} refund failed: ${a.failure_reason ?? ""}`);
}
for (const e of events) {
  add(e.received_at, "stripe", `${e.type} received (${e.id})`);
  add(e.completed_at ?? e.failed_at, "stripe", `${e.type} ${e.processing_status} after ${e.attempt_count} attempt(s)${e.last_error ? `: ${e.last_error}` : ""}`);
}
for (const r of refunds) {
  add(r.created_at, "refund", `${r.purpose} refund of ${pounds(r.expected_amount_pence)} recorded`);
  add(r.succeeded_at, "refund", `${r.purpose} refund succeeded (${r.stripe_refund_id})`);
  add(r.failed_at, "refund", `${r.purpose} refund failed: ${r.failure_reason ?? ""}`);
  add(r.requires_review_at, "refund", `${r.purpose} refund needs review`);
  add(r.cancelled_at, "refund", `${r.purpose} refund cancelled`);
}
for (const m of emails) {
  add(m.created_at, "email", `${m.event_type} to ${m.recipient_role} queued (now ${m.delivery_status})`);
  add(m.sent_at, "email", `${m.event_type} to ${m.recipient_role} sent`);
}
for (const o of others) add(o.created_at, o.kind, o.detail);
rows.sort((a, b) => a.at - b.at);

console.log(`Booking ${booking.id}`);
console.log(`  ${booking.treatment ?? "treatment"} with @${booking.username} for ${booking.customer_email}, starts ${booking.start_at}`);
console.log(`  status: ${booking.status}\n`);
for (const row of rows) console.log(`${row.at.toISOString()}  ${row.source.padEnd(8)}  ${row.text}`);

// Checks: each is [description, holds].
const checks = [];
const succeededRefunds = refunds.filter((r) => r.status === "succeeded");
const refundedInDb = succeededRefunds.reduce((sum, r) => sum + Number(r.expected_amount_pence), 0);

if (booking.confirmed_at) {
  const confirming = attempts.find((a) => a.id === booking.confirming_payment_attempt_id);
  checks.push(["a confirmed booking names the payment attempt that confirmed it", Boolean(confirming)]);
  checks.push([
    "that attempt was paid",
    Boolean(confirming) && ["succeeded", "refund_required", "refunded", "refund_failed"].includes(confirming.payment_status),
  ]);
}
if (booking.status === "awaiting_payment") {
  checks.push(["an unpaid hold is not confirmed", !booking.confirmed_at]);
}
if (booking.status === "cancelled" && Number(booking.cancellation_refund_pence) > 0) {
  const cancellationRefunds = succeededRefunds.filter((r) => r.purpose === "cancellation");
  checks.push([
    `the cancellation refund of ${pounds(booking.cancellation_refund_pence)} succeeded in full`,
    cancellationRefunds.reduce((sum, r) => sum + Number(r.expected_amount_pence), 0) === Number(booking.cancellation_refund_pence),
  ]);
}
checks.push(["no Stripe event for this booking failed", events.every((e) => e.processing_status !== "failed")]);
checks.push(["no refund is stuck or needs review", refunds.every((r) => ["succeeded", "cancelled"].includes(r.status))]);

if (withStripe) {
  const local = localEnv();
  process.env.STRIPE_MODE = "test";
  process.env.STRIPE_SECRET_KEY = local.STRIPE_SECRET_KEY;
  const { getStripe } = await import("@/lib/stripe/server");
  const stripe = getStripe();
  let refundedInStripe = 0;
  for (const a of attempts.filter((attempt) => attempt.stripe_payment_intent_id)) {
    const intent = await stripe.paymentIntents.retrieve(a.stripe_payment_intent_id);
    const stripeRefunds = await stripe.refunds.list({ payment_intent: intent.id, limit: 100 });
    refundedInStripe += stripeRefunds.data.filter((r) => r.status === "succeeded").reduce((sum, r) => sum + r.amount, 0);
    console.log(`${"".padEnd(24)}  stripe    ${intent.id}: ${intent.status}, received ${pounds(intent.amount_received)}`);
    if (a.payment_status !== "expired" && a.payment_status !== "cancelled" && intent.status === "succeeded") {
      checks.push([`Stripe received what attempt ${a.attempt_number} recorded (${pounds(a.amount_charged_pence)})`, intent.amount_received === Number(a.amount_charged_pence)]);
    }
  }
  checks.push([`Stripe refunded what the database recorded (${pounds(refundedInDb)})`, refundedInStripe === refundedInDb]);
}

console.log("\nChecks");
for (const [text, holds] of checks) console.log(`  ${holds ? "agree   " : "DISAGREE"}  ${text}`);
if (!withStripe) console.log("  (add --stripe to compare with the Stripe sandbox)");
if (checks.some(([, holds]) => !holds)) process.exit(1);
