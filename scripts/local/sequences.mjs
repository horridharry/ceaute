// Event-order sequences against the LOCAL stack and the local Stripe sandbox
// (docs/reports/2026-09-28-event-order-sequences.md). Each sequence plays
// bookings, payments, Stripe messages and cancellations in an awkward order,
// then checks the database, Stripe and `local:timeline`.
//
//   npm run local:start                            (in another terminal)
//   npm run local:sequences                        all of them
//   npm run local:sequences -- S3 S6               some of them
//
// Every run starts by resetting and seeding the local database, so it needs
// the remembered Stripe account (`local:seed -- --remember-stripe-account`).
//
// What is real and what is not:
//   - Holds, Checkout Sessions, cancellations and refunds run Ceaute's own
//     code (create_validated_booking_hold, openCheckoutForHold,
//     cancelBookingWithRefund) against the real sandbox.
//   - Payments are real sandbox PaymentIntents made with exactly the
//     payment_intent_data Ceaute gave Checkout. Stripe's Checkout page itself
//     cannot be paid without a browser, so "paid" reaches the app as a
//     checkout.session.completed built from the real Session and signed with
//     the CLI secret. Everything else from Stripe (payment failed, expired,
//     refund updates) is Stripe's own, forwarded by `local:start`.
//   - Time passing is simulated by moving times in the local database.
//
// Exits 1 if any check fails. Leaves the data in place for inspection.
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { APP_ORIGIN, ROOT, SEED, appEnv, fail, localEnv, localStack, psql, stripeWebhookSecret } from "./stack.mjs";

const stack = localStack();
const local = localEnv();
if (!local.LOCAL_STRIPE_ACCOUNT_ID) fail("Run the one-time Stripe onboarding and `npm run local:seed -- --remember-stripe-account` first.");
const webhookSecret = stripeWebhookSecret(local.STRIPE_SECRET_KEY);
Object.assign(process.env, appEnv({ stack, stripeKey: local.STRIPE_SECRET_KEY, webhookSecret }));

try {
  await fetch(APP_ORIGIN, { redirect: "manual" });
} catch {
  fail(`Nothing answers on ${APP_ORIGIN}. Start the app with \`npm run local:start\` first.`);
}

const reset = spawnSync("npx", ["supabase", "db", "reset"], { cwd: ROOT, encoding: "utf8" });
if (reset.status !== 0) fail(`Could not reset the local database:\n${reset.stderr}`);
const seed = spawnSync("node", ["--import", "./scripts/local/loader/register.mjs", "scripts/local/seed.mjs"], { cwd: ROOT, encoding: "utf8" });
if (seed.status !== 0) fail(`Could not seed the local database:\n${seed.stdout}${seed.stderr}`);

const { getStripe } = await import("@/lib/stripe/server");
const { openCheckoutForHold } = await import("@/lib/bookings/checkout-session");
const { cancelBookingWithRefund } = await import("@/lib/bookings/cancel-booking");
const stripe = getStripe();
const service = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false } }).schema("ceaute");
const PAGE = SEED.providerPageId;
const CASEY = { id: SEED.customerUserId, email: SEED.customerEmail };
const JO = { id: SEED.secondCustomerUserId, email: SEED.secondCustomerEmail };
const PAT = { id: SEED.providerUserId, email: SEED.providerEmail };

// Database -------------------------------------------------------------------

const sql = (text) => psql(stack, text).trim();
const rows = (text) => JSON.parse(sql(`select coalesce(json_agg(r), '[]') from (${text}) r;`));
const one = (text) => rows(text)[0];
const booking = (id) => one(`select * from ceaute.booking where id = '${id}'`);
const attempts = (id) => rows(`select * from ceaute.booking_payment_attempt where booking_id = '${id}' order by attempt_number`);
const refundOps = (id) => rows(`select * from ceaute.booking_refund_operation where booking_id = '${id}' order by created_at`);
const emails = (id) => rows(`select event_type, recipient_role from ceaute.booking_email_outbox where booking_id = '${id}' order by created_at`);

async function waitFor(description, test, timeoutMs = 45_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await test();
    if (value) return value;
    if (Date.now() > until) throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// A London local time `days` from today, as the booking form sends it.
const at = (days, time) =>
  sql(`select to_json((((now() at time zone 'Europe/London')::date + ${days})::timestamp + time '${time}') at time zone 'Europe/London')`)
    .replaceAll('"', "");

const treatmentId = () => sql(`select id from ceaute.treatment where provider_page_id = '${PAGE}' order by display_order limit 1`);

// People -----------------------------------------------------------------------

const clients = new Map();
async function signedIn(person) {
  if (clients.has(person.email)) return clients.get(person.email);
  const admin = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: person.email });
  if (error) throw error;
  const client = createClient(stack.apiUrl, stack.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw verified.error;
  clients.set(person.email, client);
  return client;
}

// The booking journey, through Ceaute's own code ---------------------------------

async function hold(customer, startAt) {
  const { data, error } = await service.rpc("create_validated_booking_hold", {
    target_customer_profile_id: customer.id,
    target_provider_page_id: PAGE,
    target_treatment_id: treatmentId(),
    selected_add_on_ids: [],
    requested_start_at: startAt,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function openCheckout(customer, bookingId) {
  const url = await openCheckoutForHold({
    bookingId,
    profileId: customer.id,
    returnPath: `/account/bookings/${bookingId}`,
    origin: APP_ORIGIN,
  });
  if (!url.startsWith("https://checkout.stripe.com")) throw new Error(`Checkout did not open: ${url}`);
  return attempts(bookingId).at(-1);
}

// A real sandbox payment with the instructions Ceaute gave Checkout. A declined
// card makes Stripe send its own payment_intent.payment_failed.
async function pay(attempt, paymentMethod = "pm_card_visa") {
  const { payment_intent_data: data } = attempt.checkout_request_payload;
  try {
    return await stripe.paymentIntents.create({
      amount: Number(attempt.amount_charged_pence),
      currency: attempt.currency,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      payment_method: paymentMethod,
      confirm: true,
      ...data,
    });
  } catch (error) {
    if (error?.raw?.payment_intent) return error.raw.payment_intent;
    throw error;
  }
}

async function paidEvent(attempt, intent) {
  const session = await stripe.checkout.sessions.retrieve(attempt.stripe_checkout_session_id);
  return {
    id: `evt_local_${randomUUID().replaceAll("-", "")}`,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: { ...session, status: "complete", payment_status: "paid", payment_intent: intent.id, amount_total: intent.amount },
    },
  };
}

async function deliver(event) {
  const payload = JSON.stringify(event);
  const response = await fetch(`${APP_ORIGIN}/api/stripe/payments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret }),
    },
    body: payload,
  });
  return response.status;
}

async function payAndConfirm(attempt, paymentMethod) {
  const intent = await pay(attempt, paymentMethod);
  const event = await paidEvent(attempt, intent);
  const status = await deliver(event);
  return { intent, event, status };
}

async function cancel(person, bookingId, actor) {
  return cancelBookingWithRefund({ supabase: await signedIn(person), bookingId, actor, revalidatePaths: [] });
}

// Simulates the clock reaching two hours before the appointment.
function moveInsideDeadline(bookingId) {
  sql(`update ceaute.booking set start_at = now() + interval '2 hours', end_at = now() + interval '3 hours' where id = '${bookingId}';`);
}

const refundSettled = (bookingId) => () => {
  const ops = refundOps(bookingId);
  return ops.length && ops.every((op) => ["succeeded", "failed", "requires_review", "cancelled"].includes(op.status)) && ops;
};

function timeline(bookingId) {
  const run = spawnSync(
    "node",
    ["--import", "./scripts/local/loader/register.mjs", "scripts/local/timeline.mjs", bookingId, "--stripe"],
    { cwd: ROOT, encoding: "utf8" },
  );
  return { agrees: run.status === 0, output: run.stdout + run.stderr };
}

async function expireOpenSessions(bookingId) {
  for (const attempt of attempts(bookingId)) {
    if (!attempt.stripe_checkout_session_id) continue;
    const session = await stripe.checkout.sessions.retrieve(attempt.stripe_checkout_session_id);
    if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
  }
}

// Sequences --------------------------------------------------------------------

function simultaneousCancel(deadline) {
  return async (check) => {
    const id = await hold(CASEY, at(3, deadline === "early" ? "10:00" : "13:00"));
    await payAndConfirm(await openCheckout(CASEY, id));
    check("the booking is confirmed", booking(id).status === "confirmed");
    if (deadline === "late") moveInsideDeadline(id);

    const results = await Promise.allSettled([cancel(CASEY, id, "customer"), cancel(PAT, id, "provider")]);
    const outcomes = results.map((r) => (r.status === "fulfilled" ? r.value.outcome : `error: ${r.reason?.message}`));
    check(`one cancellation wins and the other sees it (${outcomes.join(", ")})`, outcomes.sort().join() === "already_cancelled,cancelled");

    const after = booking(id);
    const winner = after.cancelled_by;
    const expectedRefund = winner === "provider" || deadline === "early" ? 1500 : 0;
    check(`recorded once, cancelled by ${winner}`, after.status === "cancelled" && Boolean(winner));
    check(`refund is £${expectedRefund / 100} and £${(1500 - expectedRefund) / 100} is kept`,
      Number(after.cancellation_refund_pence) === expectedRefund && Number(after.cancellation_retained_pence) === 1500 - expectedRefund);
    if (expectedRefund) await waitFor("the refund to settle", refundSettled(id));
    check("at most one refund", refundOps(id).length === (expectedRefund ? 1 : 0));
    const loser = winner === "provider" ? "customer_cancelled" : "provider_cancelled";
    check("only the winner's cancellation emails", emails(id).every((e) => !e.event_type.startsWith(loser)));
    return [id];
  };
}

const SEQUENCES = {
  "S1-early": {
    title: "Casey and Pat cancel at the same moment, before the deadline",
    run: simultaneousCancel("early"),
  },
  "S1-late": {
    title: "Casey and Pat cancel at the same moment, after the deadline",
    run: simultaneousCancel("late"),
  },

  S2: {
    title: "Casey pays, Pat cancels and refunds, then Stripe sends the paid message again",
    run: async (check) => {
      const id = await hold(CASEY, at(4, "10:00"));
      const { event } = await payAndConfirm(await openCheckout(CASEY, id));
      await cancel(PAT, id, "provider");
      await waitFor("the refund to settle", refundSettled(id));
      const emailCount = emails(id).length;

      const repeat = await deliver(event);
      const fresh = await deliver({ ...event, id: `evt_local_${randomUUID().replaceAll("-", "")}` });
      check(`both repeats are acknowledged (${repeat}, ${fresh})`, repeat === 200 && fresh === 200);
      check("the booking stays cancelled", booking(id).status === "cancelled");
      check("still exactly one refund", refundOps(id).length === 1);
      check("no new emails", emails(id).length === emailCount);
      return [id];
    },
  },

  S3: {
    title: "Casey's paid message arrives after her hold ran out and Jo took the time",
    run: async (check) => {
      const startAt = at(5, "10:00");
      const caseyId = await hold(CASEY, startAt);
      const attempt = await openCheckout(CASEY, caseyId);
      const intent = await pay(attempt);
      const event = await paidEvent(attempt, intent);

      sql(`update ceaute.booking set expires_at = now() - interval '1 second' where id = '${caseyId}';`);
      const joId = await hold(JO, startAt);
      await payAndConfirm(await openCheckout(JO, joId));
      check("Jo's booking is confirmed", booking(joId).status === "confirmed");

      check("Casey's late message is acknowledged", (await deliver(event)) === 200);
      await waitFor("Casey's refund to settle", refundSettled(caseyId));
      const ops = refundOps(caseyId);
      check("Casey has no booking", booking(caseyId).status !== "confirmed");
      check("Casey is refunded £15 once, as a late payment",
        ops.length === 1 && ops[0].purpose === "late_payment" && Number(ops[0].expected_amount_pence) === 1500 && ops[0].status === "succeeded");
      check("one late-payment email to Casey", emails(caseyId).filter((e) => e.event_type.startsWith("late_payment")).length === 1);
      check("Jo's booking is untouched", booking(joId).status === "confirmed");
      return [caseyId, joId];
    },
  },

  S4: {
    title: "Casey's card is declined, she pays on a second page, then also on the first",
    run: async (check) => {
      const id = await hold(CASEY, at(6, "10:00"));
      const first = await openCheckout(CASEY, id);
      const declined = await pay(first, "pm_card_chargeDeclined");
      check("Stripe declined the first card", declined.status === "requires_payment_method");
      await waitFor("Ceaute to hear about the decline", () =>
        one(`select processing_status from ceaute.stripe_payment_event where type = 'payment_intent.payment_failed' and stripe_payment_intent_id = '${declined.id}'`)?.processing_status
          ?.match(/completed|failed|ignored/));
      const declineEvent = one(`select processing_status, last_error from ceaute.stripe_payment_event where stripe_payment_intent_id = '${declined.id}'`);
      check(`Ceaute processed Stripe's decline message (${declineEvent.processing_status}${declineEvent.last_error ? `: ${declineEvent.last_error}` : ""})`,
        declineEvent.processing_status === "completed");
      check("the first attempt is marked failed", attempts(id)[0].payment_status === "failed");

      const second = await openCheckout(CASEY, id);
      check("a second payment page opened", second.id !== first.id);
      await payAndConfirm(second);
      check("the second payment confirms the booking", booking(id).confirming_payment_attempt_id === second.id);

      check("the payment on the first page is acknowledged", (await payAndConfirm(first)).status === 200);
      await waitFor("the duplicate refund to settle", refundSettled(id));
      const ops = refundOps(id);
      check("the duplicate is refunded £15 once",
        ops.length === 1 && ops[0].purpose === "duplicate_payment" && Number(ops[0].expected_amount_pence) === 1500 && ops[0].status === "succeeded");
      check("the booking stays confirmed", booking(id).status === "confirmed");
      return [id];
    },
  },

  S5: {
    title: "The first page's expired message arrives while Casey pays on her second page",
    run: async (check) => {
      const id = await hold(CASEY, at(7, "10:00"));
      const first = await openCheckout(CASEY, id);
      await pay(first, "pm_card_chargeDeclined");
      await waitFor("the first attempt to fail", () => attempts(id)[0].payment_status === "failed", 20_000).catch(() => {});
      const second = await openCheckout(CASEY, id);
      check("a second payment page opened", second.id !== first.id);

      await stripe.checkout.sessions.expire(first.stripe_checkout_session_id);
      await waitFor("the first page's expiry to arrive", () => attempts(id)[0].payment_status === "expired");
      check("Casey's time is still held", booking(id).status === "awaiting_payment");

      await payAndConfirm(second);
      check("the second payment confirms the booking", booking(id).status === "confirmed");
      check("nothing is refunded", refundOps(id).length === 0);
      return [id];
    },
  },

  S6: {
    title: "Casey pays with the card whose refunds fail, then Pat cancels",
    run: async (check) => {
      const id = await hold(CASEY, at(8, "10:00"));
      const { intent } = await payAndConfirm(await openCheckout(CASEY, id), "pm_card_refundFail");
      await cancel(PAT, id, "provider");
      // This card's refunds first report success, then fail a minute or two
      // later with refund.failed.
      await waitFor("Stripe's refund.failed message to be processed", () =>
        one(`select 1 as done from ceaute.stripe_payment_event where type = 'refund.failed'
             and stripe_payment_intent_id = '${intent.id}' and processing_status in ('completed', 'failed', 'ignored')`), 240_000);

      const recover = await fetch(`${APP_ORIGIN}/api/cron/recover-booking-refunds`, {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      check(`the refund recovery job runs (${recover.status})`, recover.ok);
      const op = refundOps(id)[0];
      const stripeRefunds = await stripe.refunds.list({ payment_intent: intent.id });
      check(`the refund is recorded as failed (${op.status})`, op.status === "failed");
      check(`Stripe holds exactly one refund (${stripeRefunds.data.map((r) => r.status).join(", ")})`, stripeRefunds.data.length === 1);
      const attempt = attempts(id)[0];
      check(`the payment shows the refund failed (${attempt.payment_status})`, attempt.payment_status === "refund_failed" && !attempt.refunded_at);
      check("no email says the refund went through", emails(id).every((e) => !/refund(ed|_succeeded)/.test(e.event_type)));
      check("one operator email says the refund failed", emails(id).filter((e) => e.event_type === "refund_failed_operator" && e.recipient_role === "operator").length === 1);
      // local:timeline still flags the failed refund, as it should; its
      // Stripe comparison agrees (£0 refunded on both sides).
      return { ids: [id], timelineMayDisagree: true };
    },
  },

  S7: {
    title: "Pat stops taking bookings while Casey is on the payment page",
    run: async (check) => {
      const id = await hold(CASEY, at(9, "10:00"));
      const attempt = await openCheckout(CASEY, id);
      const accepted = one(`select * from ceaute.provider_agreement_acceptance where provider_page_id = '${PAGE}'`);
      sql(`delete from ceaute.provider_agreement_acceptance where provider_page_id = '${PAGE}';`);
      try {
        const refused = await hold(JO, at(9, "13:00")).then(() => null, (error) => error.message);
        check(`a new customer cannot book (${refused})`, Boolean(refused));
        await payAndConfirm(attempt);
        check("Casey's booking is confirmed", booking(id).status === "confirmed");
      } finally {
        sql(`insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
             values ('${PAGE}', '${accepted.agreement_version}', '${accepted.accepted_by_profile_id}');`);
      }
      return [id];
    },
  },

  S8: {
    title: "Pat raises the deposit to £20 while Casey pays, then Casey cancels late",
    run: async (check) => {
      const id = await hold(CASEY, at(10, "10:00"));
      const attempt = await openCheckout(CASEY, id);
      sql(`update ceaute.provider_booking_setting set deposit_amount_pence = 2000 where provider_page_id = '${PAGE}';`);
      try {
        const { intent } = await payAndConfirm(attempt);
        check(`Casey is charged £15 (${intent.amount})`, intent.amount === 1500);
        moveInsideDeadline(id);
        await cancel(CASEY, id, "customer");
        const after = booking(id);
        check(`Pat keeps £15, not £20 (kept ${after.cancellation_retained_pence}, refunded ${after.cancellation_refund_pence})`,
          Number(after.cancellation_retained_pence) === 1500 && Number(after.cancellation_refund_pence) === 0);
      } finally {
        sql(`update ceaute.provider_booking_setting set deposit_amount_pence = 1500 where provider_page_id = '${PAGE}';`);
      }
      return [id];
    },
  },

  S9: {
    title: "Pat hides Casey's date while she is paying",
    run: async (check) => {
      const id = await hold(CASEY, at(11, "10:00"));
      const attempt = await openCheckout(CASEY, id);
      const drop = one(`select id, opens_at from ceaute.availability_drop where provider_page_id = '${PAGE}' order by opens_at limit 1`);
      sql(`update ceaute.availability_drop set opens_at = now() + interval '7 days' where id = '${drop.id}';`);
      try {
        const { data: openDates } = await service.rpc("get_public_open_dates", { target_provider_page_id: PAGE });
        check("the date is hidden from the page", !(openDates ?? []).some((d) => d.local_date === at(11, "12:00").slice(0, 10)));
        await payAndConfirm(attempt);
        check("Casey's booking stands (owner decision)", booking(id).status === "confirmed");
      } finally {
        sql(`update ceaute.availability_drop set opens_at = '${drop.opens_at}' where id = '${drop.id}';`);
      }
      return [id];
    },
  },
};

// Runner -----------------------------------------------------------------------

const published = one(`select status from ceaute.provider_page where id = '${PAGE}'`)?.status === "published";
if (!published) {
  const { error } = await (await signedIn(PAT)).schema("ceaute").rpc("publish_provider_page");
  if (error) fail(`Could not publish @${SEED.username}: ${error.message}`);
}

const chosen = process.argv.slice(2).map((name) => name.toUpperCase());
const names = Object.keys(SEQUENCES).filter((name) => !chosen.length || chosen.some((c) => name === c || name.startsWith(`${c}-`)));
let failures = 0;

// The local stack is shared: another session can change Pat's account or
// page mid-run. Stop rather than report its effects as Ceaute failures.
function assertTakingBookings() {
  const state = one(`select provider_page_id, stripe_transfers_status, payouts_status,
    ceaute.provider_page_accepts_new_bookings(provider_page_id) as accepts
    from ceaute.provider_payment_account where provider_page_id = '${PAGE}'`);
  if (!state?.accepts) {
    fail(`@${SEED.username} stopped taking bookings outside this run (payment account: ${
      state ? `${state.stripe_transfers_status}/${state.payouts_status}` : "missing"}). Is another session using the local stack?`);
  }
}

for (const name of names) {
  const { title, run } = SEQUENCES[name];
  const checks = [];
  const check = (text, holds) => checks.push([text, Boolean(holds)]);
  console.log(`\n${name}  ${title}`);
  assertTakingBookings();
  let ids = [];
  let timelineMayDisagree = false;
  try {
    const result = await run(check);
    ({ ids, timelineMayDisagree = false } = Array.isArray(result) ? { ids: result } : result);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (const id of ids) {
      const { agrees, output } = timeline(id);
      if (!agrees && timelineMayDisagree) {
        console.log(`  note  local:timeline disagrees for ${id.slice(0, 8)}, which this sequence expects while the refund failed`);
        continue;
      }
      check(`local:timeline agrees for ${id.slice(0, 8)}`, agrees);
      if (!agrees) console.log(output.replace(/^/gm, "      "));
    }
  } catch (error) {
    check(`ran to the end (${error.message})`, false);
  } finally {
    for (const id of ids) await expireOpenSessions(id).catch(() => {});
  }
  for (const [text, holds] of checks) console.log(`  ${holds ? "pass" : "FAIL"}  ${text}`);
  if (checks.some(([, holds]) => !holds)) failures += 1;
}

console.log(`\n${names.length - failures} of ${names.length} sequences passed.`);
process.exit(failures ? 1 : 0);
