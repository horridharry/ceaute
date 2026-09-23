-- An outbox email can be deliberately withdrawn before it is delivered: for
-- example a confirmation queued for a booking that has since been cancelled,
-- or one whose appointment has already passed. Marking such a row `sent` would
-- claim a delivery that never happened, and `failed` is retried by the sender.
-- `cancelled` is the terminal state for "never send this".
--
-- Nothing else changes. `claim_pending_booking_emails` only claims `pending`
-- and `failed` rows that are due, plus `sending` rows whose claim has expired,
-- so a `cancelled` row is never claimed. `record_booking_email_sent` and
-- `record_booking_email_retryable_failure` only act on a `sending` row holding
-- the matching claim token, so neither can move a row out of `cancelled`. The
-- delivery index stays partial on the claimable statuses, so cancelled rows
-- stay out of it.
--
-- `if exists` keeps this safe on a project where the constraint has already
-- been replaced by hand.

alter table ceaute.booking_email_outbox
  drop constraint if exists booking_email_outbox_delivery_status_check;

alter table ceaute.booking_email_outbox
  add constraint booking_email_outbox_delivery_status_check check (
    delivery_status in ('pending', 'sending', 'sent', 'failed', 'cancelled')
  );
