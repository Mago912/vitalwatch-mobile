-- Reduce el margen de medicacion demorada de 30 a 15 minutos.
-- Se modifica solamente el literal de la funcion instalada por la migracion
-- anterior y se falla de forma explicita si su definicion no es la esperada.

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'private.dispatch_due_medication_reminders()'::regprocedure
  ) into function_definition;

  if position('interval ''15 minutes''' in function_definition) > 0 then
    return;
  end if;

  if position('interval ''30 minutes''' in function_definition) = 0 then
    raise exception
      'No se encontro el margen anterior de 30 minutos en dispatch_due_medication_reminders().';
  end if;

  function_definition := replace(
    function_definition,
    'interval ''30 minutes''',
    'interval ''15 minutes'''
  );

  execute function_definition;
end;
$migration$;

comment on function private.dispatch_due_medication_reminders() is
  'Crea el recordatorio inmediato y una alerta unica si la toma sigue pendiente despues de 15 minutos.';
