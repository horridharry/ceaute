#!/bin/bash
# Two-session race checks for the provider dashboard's database rules
# (202609220002 soft deletion, 202609220003 published-portfolio guard).
# pgTAP runs each file in one transaction, so it cannot hold a lock in one
# session while a second session waits; these scenarios need real sessions.
#
# It COMMITS fictional fixture rows (provider race.publish, ids 0b…/1b…/2b…/
# 3b…/4b…/5b…), so it only runs against a disposable database:
#
#   CEAUTE_RACE_DB_IS_DISPOSABLE=1 DB_CONTAINER=<postgres container> \
#     scripts/db-races/provider-dashboard-races.sh
#
# Never point it at ceaute-dev or production.
set -u
if [ "${CEAUTE_RACE_DB_IS_DISPOSABLE:-}" != "1" ] || [ -z "${DB_CONTAINER:-}" ]; then
  echo "Refusing to run: set CEAUTE_RACE_DB_IS_DISPOSABLE=1 and DB_CONTAINER to a disposable database container." >&2
  exit 2
fi
HERE=$(cd "$(dirname "$0")" && pwd)
P="docker exec -i $DB_CONTAINER psql -U postgres -d postgres -At -q"
AS="set role authenticated; select set_config('request.jwt.claim.sub','0b000000-0000-0000-0000-000000000001',false);"
$P -v ON_ERROR_STOP=1 < "$HERE/provider-dashboard-fixture.sql" >/dev/null || { echo "Fixture failed (already loaded? use a fresh database)." >&2; exit 1; }
PG=1b000000-0000-0000-0000-000000000001
reset_photos(){ $P -c "update ceaute.provider_page set status='draft' where id='$PG';" && $P -c "delete from ceaute.portfolio_image where provider_page_id='$PG'; update ceaute.provider_page set status='$1', published_at=case when '$1'='published' then now() end where id='$PG'; insert into ceaute.portfolio_image (id,provider_page_id,storage_path,is_visible) select ('5b000000-0000-0000-0000-00000000000'||g)::uuid,'$PG','$PG/'||g||'.jpg',true from generate_series(1,$2) g;"; }
state(){ $P -c "select 'page='||status||' visible='||(select count(*) from ceaute.portfolio_image where provider_page_id='$PG' and is_visible) from ceaute.provider_page where id='$PG'"; }

echo "R1 draft page, 1 photo: DELETE last photo (holds) vs PUBLISH"
reset_photos draft 1
( $P -c "begin; $AS delete from ceaute.portfolio_image where id='5b000000-0000-0000-0000-000000000001'; select pg_sleep(3); commit;" >"${TMPDIR:-/tmp}"/ceaute-race-r1a 2>&1 ) &
sleep 1; $P -c "$AS select ceaute.publish_provider_page();" >"${TMPDIR:-/tmp}"/ceaute-race-r1b 2>&1; wait
echo "  delete: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r1a || echo committed)"; echo "  publish: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r1b || echo committed)"; echo "  final: $(state)"

echo "R2 draft page, 1 photo: PUBLISH (holds) vs DELETE last photo"
reset_photos draft 1
( $P -c "begin; $AS select ceaute.publish_provider_page(); select pg_sleep(3); commit;" >"${TMPDIR:-/tmp}"/ceaute-race-r2a 2>&1 ) &
sleep 1; $P -c "$AS delete from ceaute.portfolio_image where id='5b000000-0000-0000-0000-000000000001';" >"${TMPDIR:-/tmp}"/ceaute-race-r2b 2>&1; wait
echo "  publish: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r2a || echo committed)"; echo "  delete: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r2b || echo committed)"; echo "  final: $(state)"

echo "R3 published page, 2 photos: HIDE photo 1 (holds) vs HIDE photo 2"
reset_photos published 2
( $P -c "begin; $AS update ceaute.portfolio_image set is_visible=false where id='5b000000-0000-0000-0000-000000000001'; select pg_sleep(3); commit;" >"${TMPDIR:-/tmp}"/ceaute-race-r3a 2>&1 ) &
sleep 1; $P -c "$AS update ceaute.portfolio_image set is_visible=false where id='5b000000-0000-0000-0000-000000000002';" >"${TMPDIR:-/tmp}"/ceaute-race-r3b 2>&1; wait
echo "  hide 1: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r3a || echo committed)"; echo "  hide 2: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r3b || echo committed)"; echo "  final: $(state)"

echo "R4 published page, 2 photos: DELETE photo 1 (holds) vs HIDE photo 2"
reset_photos published 2
( $P -c "begin; $AS delete from ceaute.portfolio_image where id='5b000000-0000-0000-0000-000000000001'; select pg_sleep(3); commit;" >"${TMPDIR:-/tmp}"/ceaute-race-r4a 2>&1 ) &
sleep 1; $P -c "$AS update ceaute.portfolio_image set is_visible=false where id='5b000000-0000-0000-0000-000000000002';" >"${TMPDIR:-/tmp}"/ceaute-race-r4b 2>&1; wait
echo "  delete 1: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r4a || echo committed)"; echo "  hide 2: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r4b || echo committed)"; echo "  final: $(state)"

tx(){ echo "begin; $AS $1 select pg_sleep(3); commit;"; }
echo "R5 empty group: ARCHIVE (holds) vs MOVE a treatment into it"
( $P -c "$(tx "select ceaute.transition_treatment_group('2b000000-0000-0000-0000-000000000001','archive');")" >"${TMPDIR:-/tmp}"/ceaute-race-r5a 2>&1 ) &
sleep 1; $P -c "$AS update ceaute.treatment set treatment_group_id='2b000000-0000-0000-0000-000000000001' where id='3b000000-0000-0000-0000-000000000001';" >"${TMPDIR:-/tmp}"/ceaute-race-r5b 2>&1; wait
echo "  archive: $(grep -m1 -oE 'ERROR:.*|^(archived|unchanged)$' "${TMPDIR:-/tmp}"/ceaute-race-r5a)"; echo "  move: $(grep -m1 -oE 'ERROR:.*' "${TMPDIR:-/tmp}"/ceaute-race-r5b || echo committed)"
echo "  final: $($P -c "select 'group_active='||is_active||' treatments_in_group='||(select count(*) from ceaute.treatment where treatment_group_id=g.id) from ceaute.treatment_group g where id='2b000000-0000-0000-0000-000000000001'")"

echo "R6 archived add-on: DELETE (holds) vs DELETE again (double submit)"
( $P -c "$(tx "select ceaute.transition_treatment_add_on('4b000000-0000-0000-0000-000000000001','delete');")" >"${TMPDIR:-/tmp}"/ceaute-race-r6a 2>&1 ) &
sleep 1; $P -c "$AS select ceaute.transition_treatment_add_on('4b000000-0000-0000-0000-000000000001','delete');" >"${TMPDIR:-/tmp}"/ceaute-race-r6b 2>&1; wait
echo "  first: $(grep -m1 -oE 'ERROR:.*|^(deleted|unchanged)$' "${TMPDIR:-/tmp}"/ceaute-race-r6a)"; echo "  second: $(grep -m1 -oE 'ERROR:.*|^(deleted|unchanged)$' "${TMPDIR:-/tmp}"/ceaute-race-r6b)"
echo "  final: $($P -c "select 'is_active='||is_active||' deleted='||(deleted_at is not null) from ceaute.treatment_add_on where id='4b000000-0000-0000-0000-000000000001'")"

echo "R7 archived add-on: DELETE (holds) vs RESTORE"
( $P -c "$(tx "select ceaute.transition_treatment_add_on('4b000000-0000-0000-0000-000000000002','delete');")" >"${TMPDIR:-/tmp}"/ceaute-race-r7a 2>&1 ) &
sleep 1; $P -c "$AS select ceaute.transition_treatment_add_on('4b000000-0000-0000-0000-000000000002','restore');" >"${TMPDIR:-/tmp}"/ceaute-race-r7b 2>&1; wait
echo "  delete: $(grep -m1 -oE 'ERROR:.*|^(deleted|unchanged)$' "${TMPDIR:-/tmp}"/ceaute-race-r7a)"; echo "  restore: $(grep -m1 -oE 'ERROR:.*|^(restored|unchanged)$' "${TMPDIR:-/tmp}"/ceaute-race-r7b)"
echo "  final: $($P -c "select 'is_active='||is_active||' deleted='||(deleted_at is not null) from ceaute.treatment_add_on where id='4b000000-0000-0000-0000-000000000002'")"
