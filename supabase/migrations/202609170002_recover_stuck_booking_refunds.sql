-- Refund operations are driven synchronously by the cancellation action and
-- the payment webhook. When that driver fails after the operation is recorded
-- (Stripe unavailable, function timeout, unknown network outcome), nothing
-- retried the operation: it stayed `requested`, `pending` or `processing`
-- until a Stripe refund event happened to arrive. This adds a scheduled
-- recovery pass. The list function selects work; the existing
-- claim_booking_refund_operation still leases each operation and decides
-- whether to create, verify, reconcile, or send it to review, so the pass is
-- idempotent and cannot create a second Stripe refund.

create or replace function ceaute.list_retryable_booking_refund_operations(
  max_operations integer default 25
)
returns table (
  refund_operation_id uuid,
  refund_status text
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
  select refund_operation.id, refund_operation.status
  from ceaute.booking_refund_operation as refund_operation
  where (
      -- Recorded but never driven, for example when Stripe was unavailable
      -- during cancellation.
      refund_operation.status = 'requested'
      -- Stripe accepted a creation whose outcome is unproven, or a refund with
      -- a known id whose webhook has not arrived for an hour.
      or (
        refund_operation.status = 'pending'
        and (
          refund_operation.stripe_refund_id is null
          or coalesce(refund_operation.last_attempt_at, refund_operation.created_at)
            <= now() - interval '1 hour'
        )
      )
      -- A lease that was never released because the driver died.
      or (
        refund_operation.status = 'processing'
        and coalesce(refund_operation.processing_started_at, refund_operation.created_at)
          <= now() - interval '2 minutes'
      )
    )
    -- Give the synchronous driver time to finish before the pass steps in.
    and coalesce(refund_operation.last_attempt_at, refund_operation.created_at)
      <= now() - interval '2 minutes'
  order by refund_operation.created_at
  limit greatest(1, least(coalesce(max_operations, 25), 100));
end;
$$;

comment on function ceaute.list_retryable_booking_refund_operations(integer) is
  'Refund operations the scheduled recovery pass should hand to claim_booking_refund_operation, oldest first. Terminal and freshly attempted operations are excluded.';

revoke all on function ceaute.list_retryable_booking_refund_operations(integer)
from public, anon, authenticated;

grant execute on function ceaute.list_retryable_booking_refund_operations(integer)
to service_role;

select cron.schedule(
  'ceaute-recover-booking-refunds',
  '*/10 * * * *',
  $job$select ceaute.invoke_cron_endpoint('/api/cron/recover-booking-refunds')$job$
);
