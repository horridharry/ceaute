grant usage on schema ceaute to service_role;

grant select on table
  ceaute.provider_page,
  ceaute.treatment,
  ceaute.treatment_group,
  ceaute.treatment_add_on,
  ceaute.treatment_add_on_compatibility,
  ceaute.availability_rule,
  ceaute.blocked_date,
  ceaute.booking,
  ceaute.provider_location,
  ceaute.provider_booking_setting,
  ceaute.portfolio_image,
  ceaute.provider_payment_account
to service_role;

grant update on table
  ceaute.provider_payment_account,
  ceaute.booking
to service_role;

grant select, insert, update on table
  ceaute.booking_payment_attempt
to service_role;

grant insert on table
  ceaute.stripe_connect_event,
  ceaute.stripe_payment_event
to service_role;

grant execute on all functions in schema ceaute to service_role;
