-- VW-SUPA-01 — Delta minimo para asociar solicitudes de Mensaje/Llamada con
-- un contacto existente. No se duplican usuarios, dispositivos ni agendas.
alter table public.device_events
  add column if not exists contact_id bigint null;

alter table public.device_events
  drop constraint if exists device_events_contact_id_fkey;

alter table public.device_events
  add constraint device_events_contact_id_fkey
  foreign key (contact_id)
  references public.emergency_contacts(id)
  on delete set null;

create index if not exists device_events_contact_id_idx
  on public.device_events (contact_id)
  where contact_id is not null;

comment on column public.device_events.contact_id is
  'Contacto autorizado asociado a message_request/call_request; el telefono no viaja al ESP32.';

-- VW-SEC-01 — Defensa en profundidad. Aunque la Edge Function ya valida el
-- contacto, la base rechaza asociaciones cruzadas entre usuarios/dispositivos.
create or replace function public.validate_vitalwatch_event_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.devices device
    join public.emergency_contacts contact
      on contact.user_id = device.user_id
    where device.id = new.device_id
      and contact.id = new.contact_id
      and contact.active = true
  ) then
    raise exception 'El contacto no esta activo o no pertenece al dispositivo.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_vitalwatch_event_contact() from public, anon, authenticated;
grant execute on function public.validate_vitalwatch_event_contact() to service_role;

drop trigger if exists validate_vitalwatch_event_contact_trigger on public.device_events;
create trigger validate_vitalwatch_event_contact_trigger
before insert or update of device_id, contact_id on public.device_events
for each row execute function public.validate_vitalwatch_event_contact();
