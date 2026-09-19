create or replace function public.record_mobile_medication_taken_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  medication_name text;
begin
  if new.source <> 'mobile_app' or new.status <> 'taken' then
    return new;
  end if;

  select medication.name
  into medication_name
  from public.medications medication
  where medication.id = new.medication_id;

  insert into public.device_events (device_id, type, severity, message, event_time)
  values (
    new.device_id,
    'medication_taken',
    'info',
    coalesce(medication_name, 'La medicacion') || ' fue marcada como tomada desde la aplicacion.',
    coalesce(new.taken_at, clock_timestamp())
  );

  return new;
end;
$$;

revoke all on function public.record_mobile_medication_taken_event() from public, anon, authenticated;

drop trigger if exists record_mobile_medication_taken on public.medication_logs;
create trigger record_mobile_medication_taken
after insert on public.medication_logs
for each row execute function public.record_mobile_medication_taken_event();
