-- Rows already in `sending` before claim timestamps were introduced must also
-- be reclaimable instead of remaining stranded forever.
create or replace function ceaute.claim_pending_booking_emails(
  max_emails integer default 25
)
returns table (
  id uuid,
  claim_token uuid,
  event_type text,
  booking_id uuid,
  recipient_email text,
  recipient_role text,
  attempt_count integer,
  payload jsonb
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  return query
  with claimable_emails as (
    select booking_email_outbox.id
    from ceaute.booking_email_outbox
    where booking_email_outbox.attempt_count < 10
      and (
        (booking_email_outbox.delivery_status in ('pending', 'failed')
          and booking_email_outbox.next_retry_at <= now())
        or (booking_email_outbox.delivery_status = 'sending'
          and (
            booking_email_outbox.claimed_at is null
            or booking_email_outbox.claimed_at <= now() - interval '5 minutes'
          ))
      )
    order by booking_email_outbox.next_retry_at, booking_email_outbox.created_at
    limit greatest(1, least(coalesce(max_emails, 25), 100))
    for update skip locked
  ),
  claimed_emails as (
    update ceaute.booking_email_outbox
    set delivery_status = 'sending',
        attempt_count = booking_email_outbox.attempt_count + 1,
        claim_token = gen_random_uuid(),
        claimed_at = now(),
        last_error = null
    where booking_email_outbox.id in (select claimable_emails.id from claimable_emails)
    returning
      booking_email_outbox.id,
      booking_email_outbox.claim_token,
      booking_email_outbox.event_type,
      booking_email_outbox.booking_id,
      booking_email_outbox.recipient_email,
      booking_email_outbox.recipient_role,
      booking_email_outbox.attempt_count,
      booking_email_outbox.payload
  )
  select * from claimed_emails;
end;
$$;

revoke all on function ceaute.claim_pending_booking_emails(integer)
from public, anon, authenticated, service_role;

grant execute on function ceaute.claim_pending_booking_emails(integer)
to service_role;
