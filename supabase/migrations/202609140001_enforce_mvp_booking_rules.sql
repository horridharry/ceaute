-- Fixed MVP booking rules. PostgreSQL is authoritative for each; application
-- code mirrors them only to give earlier feedback. Existing rows which break a
-- new constraint make this migration fail rather than being rewritten.

-- The booking window is fixed at 60 days. create_validated_booking_hold accepts
-- starts through the 60th Europe/London calendar day after today, and
-- appointment-availability.js offers the same days. booking_window_days has
-- never driven either calculation; it is retained, but no longer writable by
-- providers, so it cannot look like working configuration.
revoke update (booking_window_days) on table ceaute.provider_page from authenticated;

comment on column ceaute.provider_page.booking_window_days is
  'Unused legacy value. The MVP booking window is fixed at 60 days by ceaute.create_validated_booking_hold.';

-- Ceaute has no pay-later option: in deposit mode the deposit is the whole
-- online payment, so a zero or missing deposit would leave Checkout nothing to
-- collect. Rejecting it here stops the policy being saved or published.
alter table ceaute.provider_booking_setting
  add constraint provider_booking_setting_deposit_is_positive check (
    payment_mode is distinct from 'fixed_deposit'
    or coalesce(commitment_amount_pence, 0) > 0
  );

comment on constraint provider_booking_setting_deposit_is_positive
on ceaute.provider_booking_setting is
  'Deposit mode requires a deposit greater than £0; Ceaute has no pay-later mode.';

-- Working-period boundaries sit on the same 15-minute grid as appointment
-- starts, so slot generation can step from the opening time. Durations are not
-- constrained to the grid.
alter table ceaute.availability_rule
  add constraint availability_rule_quarter_hour_boundaries check (
    extract(minute from starts_at)::integer % 15 = 0
    and extract(second from starts_at) = 0
    and extract(minute from ends_at)::integer % 15 = 0
    and extract(second from ends_at) = 0
  );
