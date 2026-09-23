-- Email the customer when a payment that arrived after their hold ended is
-- refunded automatically (approved 23 September 2026; a private-alpha
-- acceptance criterion).
--
-- complete_booking_payment_attempt records a 'late_payment' refund operation
-- for such a payment. A deferred constraint trigger on that insert writes one
-- outbox row, which the existing send-booking-emails route delivers through
-- Resend with its existing claim and retry. The outbox's unique
-- (booking_id, event_type, recipient_email) key makes a webhook replay, a
-- second late payment on the same hold or a retried transaction write nothing
-- more: one email per booking. The trigger fires at commit, after the payment
-- attempt has been marked refund_required in the same transaction.

alter table ceaute.booking_email_outbox
  drop constraint booking_email_outbox_event_type_check;

alter table ceaute.booking_email_outbox
  add constraint booking_email_outbox_event_type_check check (
    event_type in (
      'booking_confirmed_customer',
      'booking_confirmed_provider',
      'customer_cancelled_customer',
      'customer_cancelled_provider',
      'provider_cancelled_customer',
      'provider_cancelled_provider',
      'dispute_opened_operator',
      'dispute_funds_withdrawn_operator',
      'dispute_funds_reinstated_operator',
      'dispute_closed_operator',
      'late_payment_refunded_customer'
    )
  );

create function ceaute.enqueue_late_payment_refund_email()
returns trigger
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  target_booking ceaute.booking%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
begin
  if new.purpose <> 'late_payment' then
    return null;
  end if;

  select * into target_booking
  from ceaute.booking
  where id = new.booking_id;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = new.booking_payment_attempt_id;

  -- Never the private address: nothing was booked.
  insert into ceaute.booking_email_outbox (
    event_type, booking_id, recipient_email, recipient_role, payload
  )
  select
    'late_payment_refunded_customer',
    target_booking.id,
    target_booking.customer_snapshot ->> 'email',
    'customer',
    ceaute.booking_email_payload(target_booking, payment_attempt, false)
      || jsonb_build_object(
        'amount_paid_pence', payment_attempt.amount_charged_pence,
        'refund_amount_pence', new.expected_amount_pence
      )
  where nullif(target_booking.customer_snapshot ->> 'email', '') is not null
  on conflict (booking_id, event_type, recipient_email) do nothing;

  return null;
end;
$$;

revoke all on function ceaute.enqueue_late_payment_refund_email()
from public, anon, authenticated, service_role;

create constraint trigger booking_refund_operation_late_payment_email
after insert on ceaute.booking_refund_operation
deferrable initially deferred
for each row execute function ceaute.enqueue_late_payment_refund_email();
