create or replace function ceaute.replace_provider_availability_rules(
  target_provider_page_id uuid,
  rules jsonb
)
returns void
language plpgsql
set search_path = ceaute, public
as $$
begin
  if jsonb_typeof(rules) <> 'array' then
    raise exception 'Availability rules must be an array.';
  end if;

  delete from ceaute.availability_rule
  where provider_page_id = target_provider_page_id;

  insert into ceaute.availability_rule (
    provider_page_id,
    weekday,
    starts_at,
    ends_at
  )
  select
    target_provider_page_id,
    parsed_rules.weekday,
    parsed_rules.starts_at,
    parsed_rules.ends_at
  from jsonb_to_recordset(rules) as parsed_rules(
    weekday smallint,
    starts_at time,
    ends_at time
  );
end;
$$;

revoke all on function ceaute.replace_provider_availability_rules(uuid, jsonb)
from public, anon, authenticated;

grant execute on function ceaute.replace_provider_availability_rules(uuid, jsonb)
to authenticated;
