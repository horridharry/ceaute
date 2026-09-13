-- The refund claim returns Stripe identity fields that also appear in its
-- UPDATE statement, so make column precedence explicit for PL/pgSQL.
do $migration$
declare
  function_definition text;
  corrected_definition text;
begin
  function_definition := pg_get_functiondef(
    'ceaute.claim_booking_refund_operation(uuid)'::regprocedure
  );
  corrected_definition := replace(
    function_definition,
    E'AS $function$\ndeclare',
    E'AS $function$\n#variable_conflict use_column\ndeclare'
  );

  if corrected_definition = function_definition then
    raise exception 'Could not apply refund claim name-resolution directive.';
  end if;

  execute corrected_definition;
end;
$migration$;
