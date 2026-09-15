-- Supabase Cron replaces Vercel Cron as the scheduler for the two secret-protected
-- application endpoints. The endpoints and their business logic are unchanged;
-- pg_cron fires on schedule, pg_net makes the HTTP request asynchronously, and
-- the bearer token comes from Supabase Vault at call time.
--
-- The bearer token is never part of this file. Create it once per project in
-- Vault under the name `ceaute_cron_secret` with the same value as the
-- application's CRON_SECRET. Until that secret exists, each scheduled run logs a
-- notice and makes no request, so `supabase db reset`, database tests, and
-- environments without production secrets keep working.
--
-- Requests go to https://ceaute.com. A Vault secret named `ceaute_cron_base_url`
-- may override that origin for a non-production project; it is optional.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function ceaute.invoke_cron_endpoint(endpoint_path text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  cron_secret text;
  base_url text;
  request_id bigint;
begin
  if endpoint_path is null or endpoint_path !~ '^/api/cron/[a-z-]+$' then
    raise exception 'Unknown cron endpoint path.';
  end if;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'ceaute_cron_secret'
  order by created_at desc
  limit 1;

  if nullif(btrim(cron_secret), '') is null then
    raise notice 'Skipping % because the ceaute_cron_secret Vault secret is not configured.',
      endpoint_path;
    return null;
  end if;

  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name = 'ceaute_cron_base_url'
  order by created_at desc
  limit 1;

  base_url := rtrim(coalesce(nullif(btrim(base_url), ''), 'https://ceaute.com'), '/');

  select net.http_get(
    url := base_url || endpoint_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || btrim(cron_secret)),
    timeout_milliseconds := 60000
  ) into request_id;

  return request_id;
end;
$$;

comment on function ceaute.invoke_cron_endpoint(text) is
  'Queues one authenticated GET to a Ceaute cron endpoint through pg_net, using the ceaute_cron_secret Vault secret. Returns the pg_net request id, or null when no secret is configured.';

revoke all on function ceaute.invoke_cron_endpoint(text)
from public, anon, authenticated, service_role;

-- cron.schedule with a job name inserts the job or updates the existing one, so
-- re-running this migration on a reset database leaves exactly one job each.
select cron.schedule(
  'ceaute-complete-bookings',
  '0 * * * *',
  $job$select ceaute.invoke_cron_endpoint('/api/cron/complete-bookings')$job$
);

select cron.schedule(
  'ceaute-send-booking-emails',
  '*/10 * * * *',
  $job$select ceaute.invoke_cron_endpoint('/api/cron/send-booking-emails')$job$
);
