-- Fixture for scripts/db-races/provider-dashboard-races.sh. Fictional; disposable databases only.
-- Publishable provider for the P-1 concurrency checks (fictional; sandbox only).
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','0b000000-0000-0000-0000-000000000001','authenticated','authenticated','race-publish@example.test','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
update ceaute.profile set full_name='Race Provider', phone_e164='+447700900111' where id='0b000000-0000-0000-0000-000000000001';
insert into ceaute.provider_page (id, owner_profile_id, username, display_name, biography, provider_category, status)
values ('1b000000-0000-0000-0000-000000000001','0b000000-0000-0000-0000-000000000001','race.publish','Race Publish','Ready provider','Nails','draft');
insert into ceaute.provider_location (provider_page_id, public_area, address_line_1, city, postcode, is_active)
values ('1b000000-0000-0000-0000-000000000001','Central London','10 Test Street','London','W1A 1AA',true);
insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at) values ('1b000000-0000-0000-0000-000000000001',1,'09:00','17:00');
insert into ceaute.treatment (provider_page_id,name,description,duration_minutes,price_pence,discovery_category_id,is_active)
values ('1b000000-0000-0000-0000-000000000001','Race manicure','Fixture',60,5000,(select id from ceaute.discovery_category order by display_order limit 1),true);
insert into ceaute.provider_booking_setting (provider_page_id,payment_mode,deposit_percent,cancellation_window_hours,written_policy)
values ('1b000000-0000-0000-0000-000000000001','full',20,24,'Fixture');
insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
values ('1b000000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '0b000000-0000-0000-0000-000000000001');
insert into ceaute.provider_payment_account (provider_page_id,stripe_account_id,dashboard,identity_country,recipient_applied,stripe_transfers_status,payouts_status,requirements_currently_due,requirements_past_due,requirements_eventually_due,last_stripe_update_at)
values ('1b000000-0000-0000-0000-000000000001','acct_race_publish','express','GB',true,'active','active',array[]::text[],array[]::text[],array[]::text[],now());
insert into ceaute.treatment_group (id, provider_page_id, name) values ('2b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000001','Race group');
insert into ceaute.treatment (id, provider_page_id, name, description, duration_minutes, price_pence) values ('3b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000001','Race mover','Fixture',60,1000);
insert into ceaute.treatment_add_on (id, provider_page_id, name, additional_price_pence, additional_duration_minutes, is_active) values
 ('4b000000-0000-0000-0000-000000000001','1b000000-0000-0000-0000-000000000001','Race add-on one',500,0,false),
 ('4b000000-0000-0000-0000-000000000002','1b000000-0000-0000-0000-000000000001','Race add-on two',500,0,false);
