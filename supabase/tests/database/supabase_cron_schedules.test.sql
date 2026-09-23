begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, ceaute;

select plan(21);

select has_extension('pg_cron', 'pg_cron is installed for Supabase Cron');
select has_extension('pg_net', 'pg_net is installed for outbound HTTP requests');

select is(
  (
    select count(*)
    from cron.job
    where jobname = 'ceaute-complete-bookings'
      and schedule = '0 * * * *'
      and active
  ),
  1::bigint,
  'Booking completion is scheduled exactly hourly'
);

select is(
  (
    select count(*)
    from cron.job
    where jobname = 'ceaute-send-booking-emails'
      and schedule = '*/10 * * * *'
      and active
  ),
  1::bigint,
  'Booking email delivery is scheduled exactly every 10 minutes'
);

select is(
  (select command from cron.job where jobname = 'ceaute-complete-bookings'),
  $job$select ceaute.invoke_cron_endpoint('/api/cron/complete-bookings')$job$,
  'The hourly job calls the booking completion endpoint'
);

select is(
  (select command from cron.job where jobname = 'ceaute-send-booking-emails'),
  $job$select ceaute.invoke_cron_endpoint('/api/cron/send-booking-emails')$job$,
  'The 10-minute job calls the booking email endpoint'
);

select is(
  (
    select count(*)
    from cron.job
    where jobname = 'ceaute-recover-booking-refunds'
      and schedule = '*/10 * * * *'
      and active
  ),
  1::bigint,
  'Refund recovery is scheduled exactly every 10 minutes'
);

select is(
  (select command from cron.job where jobname = 'ceaute-recover-booking-refunds'),
  $job$select ceaute.invoke_cron_endpoint('/api/cron/recover-booking-refunds')$job$,
  'The refund recovery job calls the refund recovery endpoint'
);

-- The rest of this test controls Vault contents inside the transaction so it
-- never depends on, or leaks, a real secret. Everything is rolled back.
delete from vault.secrets
where name in ('ceaute_cron_secret', 'ceaute_cron_base_url', 'ceaute_cron_protection_bypass');

select is(
  ceaute.invoke_cron_endpoint('/api/cron/complete-bookings'),
  null,
  'Without a Vault secret the job makes no request and does not fail'
);

select vault.create_secret('test-cron-secret', 'ceaute_cron_secret');
select vault.create_secret('http://127.0.0.1:9/', 'ceaute_cron_base_url');

-- Call the function exactly once and keep its request id; a volatile function
-- in a WHERE clause could otherwise be evaluated per row.
create temp table cron_request_id as
select ceaute.invoke_cron_endpoint('/api/cron/send-booking-emails') as id;

select is(
  (select count(*) from cron_request_id where id is not null),
  1::bigint,
  'With a Vault secret the job queues one pg_net request'
);

select is(
  (
    select url
    from net.http_request_queue
    where id = (select id from cron_request_id)
  ),
  'http://127.0.0.1:9/api/cron/send-booking-emails',
  'The request targets the endpoint path under the configured origin'
);

select is(
  (
    select headers ->> 'Authorization'
    from net.http_request_queue
    where id = (select id from cron_request_id)
  ),
  'Bearer test-cron-secret',
  'The request carries the Vault secret as a bearer token'
);

select is(
  (
    select array_agg(header_name order by header_name)
    from net.http_request_queue, jsonb_object_keys(headers) as header_name
    where id = (select id from cron_request_id)
  ),
  array['Authorization'],
  'Without a bypass secret the request sends no Vercel protection bypass header'
);

-- Vercel Deployment Protection: the bypass secret is optional and additive.
select vault.create_secret('test-bypass-secret', 'ceaute_cron_protection_bypass');

create temp table bypass_request_id as
select ceaute.invoke_cron_endpoint('/api/cron/complete-bookings') as id;

select is(
  (
    select url
    from net.http_request_queue
    where id = (select id from bypass_request_id)
  ),
  'http://127.0.0.1:9/api/cron/complete-bookings',
  'With a bypass secret the endpoint URL is built exactly as before'
);

select is(
  (
    select headers ->> 'Authorization'
    from net.http_request_queue
    where id = (select id from bypass_request_id)
  ),
  'Bearer test-cron-secret',
  'With a bypass secret the bearer token is unchanged'
);

select is(
  (
    select headers ->> 'x-vercel-protection-bypass'
    from net.http_request_queue
    where id = (select id from bypass_request_id)
  ),
  'test-bypass-secret',
  'With a bypass secret the request carries it as x-vercel-protection-bypass'
);

select is(
  (
    select array_agg(header_name order by header_name)
    from net.http_request_queue, jsonb_object_keys(headers) as header_name
    where id = (select id from bypass_request_id)
  ),
  array['Authorization', 'x-vercel-protection-bypass'],
  'With a bypass secret the request carries exactly the two expected headers'
);

select vault.update_secret(
  (select id from vault.secrets where name = 'ceaute_cron_protection_bypass'),
  '   '
);

create temp table blank_bypass_request_id as
select ceaute.invoke_cron_endpoint('/api/cron/recover-booking-refunds') as id;

select is(
  (
    select array_agg(header_name order by header_name)
    from net.http_request_queue, jsonb_object_keys(headers) as header_name
    where id = (select id from blank_bypass_request_id)
  ),
  array['Authorization'],
  'A blank bypass secret is treated as absent'
);

select throws_matching(
  $$select ceaute.invoke_cron_endpoint('/../not-a-cron-endpoint')$$,
  'Unknown cron endpoint path',
  'Only cron endpoint paths can be invoked'
);

set local role authenticated;
select throws_matching(
  $$select ceaute.invoke_cron_endpoint('/api/cron/complete-bookings')$$,
  'permission denied',
  'Application roles cannot trigger cron endpoints'
);
reset role;

select ok(
  not has_function_privilege('service_role', 'ceaute.invoke_cron_endpoint(text)', 'execute')
    and not has_function_privilege('anon', 'ceaute.invoke_cron_endpoint(text)', 'execute'),
  'Only the database owner can run the cron invoker'
);

select * from finish();

rollback;
