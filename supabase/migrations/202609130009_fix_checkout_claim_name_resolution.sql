-- The Checkout claim returns payment_status, so prefer table columns when the
-- PL/pgSQL output variable has the same name. This compiler directive is
-- embedded in the existing function body without requiring a privileged GUC.
do $migration$
declare
  function_definition text;
  corrected_definition text;
begin
  function_definition := pg_get_functiondef(
    'ceaute.claim_booking_checkout(uuid,bigint,bigint,bigint,bigint,text,text,text,text)'::regprocedure
  );
  corrected_definition := replace(
    function_definition,
    E'AS $function$\ndeclare',
    E'AS $function$\n#variable_conflict use_column\ndeclare'
  );

  if corrected_definition = function_definition then
    raise exception 'Could not apply Checkout claim name-resolution directive.';
  end if;

  execute corrected_definition;
end;
$migration$;
