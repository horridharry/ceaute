-- Fictional fixture for scripts/db-races/booking-races.sh. It is COMMITTED, so
-- load it only into a disposable database. Provider race.booking, ids 0c…/1c…/2c….
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '0c000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'race-customer-1@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0c000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'race-customer-2@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0c000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'race-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Race Person', phone_e164 = '+447700900777'
where id::text like '0c000000-%';

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, provider_category, status)
values ('1c000000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000003', 'race.booking', 'Race Booking', 'Nails', 'published');

insert into ceaute.provider_location (provider_page_id, public_area, address_line_1, city, postcode, is_active)
values ('1c000000-0000-0000-0000-000000000001', 'Hackney, London', '1 Race Street', 'London', 'E8 1AA', true);

insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, deposit_percent, cancellation_window_hours)
values ('1c000000-0000-0000-0000-000000000001', 'deposit', 30, 24);

insert into ceaute.provider_payment_account (provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status)
values ('1c000000-0000-0000-0000-000000000001', 'acct_race', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
values ('1c000000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '0c000000-0000-0000-0000-000000000003');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '1c000000-0000-0000-0000-000000000001', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.treatment (id, provider_page_id, name, duration_minutes, price_pence, is_active)
values ('2c000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'Race manicure', 60, 4725, true);
