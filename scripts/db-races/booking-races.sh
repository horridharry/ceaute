#!/bin/bash
# Two-session race checks for booking holds, Checkout claims and late
# payments (202609230001-04: percentage terms, 10-minute holds, the claim's
# snapshot check, the late-payment refund email). pgTAP runs each file in one
# transaction, so it cannot hold a lock in one session while another waits.
#
# It COMMITS fictional fixture rows (provider race.booking, ids 0c…/1c…/2c…),
# so it only runs against a disposable database:
#
#   CEAUTE_RACE_DB_IS_DISPOSABLE=1 DB_CONTAINER=<postgres container> \
#     scripts/db-races/booking-races.sh
#
# Never point it at ceaute-dev or production.
set -u
if [ "${CEAUTE_RACE_DB_IS_DISPOSABLE:-}" != "1" ] || [ -z "${DB_CONTAINER:-}" ]; then
  echo "Refusing to run: set CEAUTE_RACE_DB_IS_DISPOSABLE=1 and DB_CONTAINER to a disposable database container." >&2
  exit 2
fi
HERE=$(cd "$(dirname "$0")" && pwd)
P="docker exec -i $DB_CONTAINER psql -U postgres -d postgres -At -q"
SR="set role service_role; select set_config('request.jwt.claim.role','service_role',false);"
T=${TMPDIR:-/tmp}/ceaute-booking-race
$P -v ON_ERROR_STOP=1 < "$HERE/booking-race-fixture.sql" >/dev/null || { echo "Fixture failed (already loaded? use a fresh database)." >&2; exit 1; }
PAGE=1c000000-0000-0000-0000-000000000001
TREAT=2c000000-0000-0000-0000-000000000001
C1=0c000000-0000-0000-0000-000000000001
C2=0c000000-0000-0000-0000-000000000002
slot(){ echo "((((now() at time zone 'Europe/London')::date + $1)::timestamp + time '$2') at time zone 'Europe/London')"; }
hold(){ echo "select ceaute.create_validated_booking_hold('$1','$PAGE','$TREAT',array[]::uuid[],$(slot $2 $3));"; }
err(){ grep -m1 -oE 'ERROR:.*' "$1" || echo committed; }

echo "B1 two customers, the same time: HOLD (holds its transaction) vs HOLD"
( $P -c "begin; $SR $(hold $C1 3 12:00) select pg_sleep(3); commit;" >"$T-b1a" 2>&1 ) &
sleep 1; $P -c "$SR $(hold $C2 3 12:00)" >"$T-b1b" 2>&1; wait
echo "  first: $(err "$T-b1a")"; echo "  second: $(err "$T-b1b")"
echo "  final: $($P -c "select 'holds_at_slot='||count(*) from ceaute.booking where provider_page_id='$PAGE' and start_at=$(slot 3 12:00) and status='awaiting_payment'")"

echo "B2 provider changes the percentage (holds) while a customer holds a time"
( $P -c "begin; update ceaute.provider_booking_setting set deposit_percent=50 where provider_page_id='$PAGE'; select pg_sleep(3); commit;" >"$T-b2a" 2>&1 ) &
sleep 1; $P -c "$SR $(hold $C1 3 14:00)" >"$T-b2b" 2>&1; wait
echo "  settings: $(err "$T-b2a")"; echo "  hold: $(err "$T-b2b")"
echo "  snapshot: $($P -c "select 'percent='||(service_snapshot->>'deposit_percent')||' pay_now='||(service_snapshot->>'amount_due_now_pence')||' kept='||(service_snapshot->>'commitment_amount_pence')||' consistent='||((service_snapshot->>'amount_due_now_pence')::bigint = (select amount_due_now_pence from ceaute.booking_payment_terms((service_snapshot->>'total_price_pence')::bigint, service_snapshot->>'payment_mode', (service_snapshot->>'deposit_percent')::int))) from ceaute.booking where provider_page_id='$PAGE' and start_at=$(slot 3 14:00)")"
$P -c "$SR $(hold $C2 3 16:00)" >/dev/null 2>&1
echo "  next hold: $($P -c "select 'percent='||(service_snapshot->>'deposit_percent')||' pay_now='||(service_snapshot->>'amount_due_now_pence') from ceaute.booking where provider_page_id='$PAGE' and start_at=$(slot 3 16:00)")"

echo "B3 double Continue to payment: CLAIM (holds) vs CLAIM for the same hold"
B3=$($P -c "$SR $(hold $C1 5 10:00)" | tail -1)
PAYNOW=$($P -c "select service_snapshot->>'amount_due_now_pence' from ceaute.booking where id='$B3'")
LATER=$((4725 - PAYNOW))
CLAIM="select action from ceaute.claim_booking_checkout('$B3', $PAYNOW, 4725, $LATER, 100, 'gbp', 'acct_race', 'https://example.test/s', 'https://example.test/c');"
( $P -c "begin; $SR $CLAIM select pg_sleep(3); commit;" >"$T-b3a" 2>&1 ) &
sleep 1; $P -c "$SR $CLAIM" >"$T-b3b" 2>&1; wait
outcome(){ grep -oE 'ERROR:.*|^(create|reuse|processing|terminal|booking_unavailable|provider_unavailable|refund_required|confirmed|already_processed|[a-z]+_refund[a-z_]*)$' "$1" | tail -1; }
echo "  first: $(outcome "$T-b3a")"
echo "  second: $(outcome "$T-b3b")"
echo "  final: $($P -c "select 'attempts='||count(*) from ceaute.booking_payment_attempt where booking_id='$B3'")"

echo "B4 a late payment delivered twice at once: COMPLETE (holds) vs COMPLETE"
B4=$($P -c "$SR $(hold $C2 6 10:00)" | tail -1)
PAYNOW=$($P -c "select service_snapshot->>'amount_due_now_pence' from ceaute.booking where id='$B4'")
LATER=$((4725 - PAYNOW))
ATTEMPT=$($P -c "$SR select payment_attempt_id||' '||claim_token||' '||(checkout_request_payload->>'expires_at') from ceaute.claim_booking_checkout('$B4', $PAYNOW, 4725, $LATER, 100, 'gbp', 'acct_race', 'https://example.test/s', 'https://example.test/c');" | tail -1)
read -r AID TOKEN EXP <<<"$ATTEMPT"
$P -c "$SR select ceaute.record_booking_checkout_session('$AID','$TOKEN','cs_race_b4','pi_race_b4','https://checkout.stripe.test/b4',to_timestamp($EXP));" >/dev/null
$P -c "update ceaute.booking set expires_at = now() - interval '1 minute' where id='$B4';"
DONE="select outcome from ceaute.complete_booking_payment_attempt('$AID','pi_race_b4','cs_race_b4','paid','gbp',$PAYNOW);"
( $P -c "begin; $SR $DONE select pg_sleep(3); commit;" >"$T-b4a" 2>&1 ) &
sleep 1; $P -c "$SR $DONE" >"$T-b4b" 2>&1; wait
echo "  first: $(outcome "$T-b4a")"; echo "  second: $(outcome "$T-b4b")"
echo "  final: $($P -c "select 'booking='||b.status||' refunds='||(select count(*) from ceaute.booking_refund_operation where booking_id=b.id and purpose='late_payment')||' emails='||(select count(*) from ceaute.booking_email_outbox where booking_id=b.id and event_type='late_payment_refunded_customer')||' confirmation_emails='||(select count(*) from ceaute.booking_email_outbox where booking_id=b.id and event_type like 'booking_confirmed%') from ceaute.booking b where b.id='$B4'")"
