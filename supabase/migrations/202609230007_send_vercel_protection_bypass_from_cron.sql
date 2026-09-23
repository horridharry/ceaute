-- A non-production project points its cron jobs at a Vercel Preview
-- deployment, which sits behind Vercel Deployment Protection. Vercel lets
-- automation through when the request carries `x-vercel-protection-bypass`
-- with a Protection Bypass for Automation secret.
--
-- The bypass is optional and, like the bearer token, lives only in Supabase
-- Vault, under `ceaute_cron_protection_bypass`. When it is present the request
-- carries it alongside the unchanged Authorization header; when it is absent
-- or blank the request is exactly what it was before, so Production and local
-- databases are unaffected. The URL, the fallback origin and the skip-without-
-- secret behaviour are unchanged.

create or replace function ceaute.invoke_cron_endpoint(endpoint_path text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  cron_secret text;
  base_url text;
  protection_bypass text;
  request_headers jsonb;
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

  select decrypted_secret into protection_bypass
  from vault.decrypted_secrets
  where name = 'ceaute_cron_protection_bypass'
  order by created_at desc
  limit 1;

  request_headers := jsonb_build_object('Authorization', 'Bearer ' || btrim(cron_secret));

  if nullif(btrim(protection_bypass), '') is not null then
    request_headers := request_headers
      || jsonb_build_object('x-vercel-protection-bypass', btrim(protection_bypass));
  end if;

  select net.http_get(
    url := base_url || endpoint_path,
    headers := request_headers,
    timeout_milliseconds := 60000
  ) into request_id;

  return request_id;
end;
$$;

comment on function ceaute.invoke_cron_endpoint(text) is
  'Queues one authenticated GET to a Ceaute cron endpoint through pg_net, using the ceaute_cron_secret Vault secret and, when present, the ceaute_cron_protection_bypass Vault secret as x-vercel-protection-bypass. Returns the pg_net request id, or null when no secret is configured.';

revoke all on function ceaute.invoke_cron_endpoint(text)
from public, anon, authenticated, service_role;
