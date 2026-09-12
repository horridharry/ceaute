-- These RETURNS TABLE functions intentionally share output names with table
-- columns. Pin PL/pgSQL's resolution at compile time so table predicates are
-- never interpreted as references to an uninitialised output variable.
do $$
declare
  target_function regprocedure;
  original_definition text;
  corrected_definition text;
begin
  foreach target_function in array array[
    'ceaute.claim_booking_checkout(uuid,bigint,bigint,bigint,bigint,text,text)'::regprocedure,
    'ceaute.prepare_booking_cancellation(uuid,text)'::regprocedure
  ]
  loop
    original_definition := pg_get_functiondef(target_function);
    corrected_definition := replace(
      original_definition,
      'AS $function$' || chr(10),
      'AS $function$' || chr(10) || '#variable_conflict use_column' || chr(10)
    );

    if corrected_definition = original_definition then
      raise exception 'Could not pin name resolution for %.', target_function;
    end if;

    execute corrected_definition;
  end loop;
end;
$$;
