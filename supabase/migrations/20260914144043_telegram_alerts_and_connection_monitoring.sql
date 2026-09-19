-- Telegram reemplaza a SMS como canal remoto. Los registros SMS anteriores se
-- conservan para no perder el historial de las pruebas ya realizadas.
alter table public.emergency_contacts
  alter column phone_e164 drop not null,
  add column telegram_chat_id bigint,
  add column telegram_username text;

alter table public.emergency_contacts
  drop constraint emergency_contacts_channel_check,
  add constraint emergency_contacts_channel_check
    check (channel in ('sms', 'telegram')),
  add constraint emergency_contacts_channel_data_check
    check (
      (channel = 'sms' and phone_e164 is not null) or
      (channel = 'telegram' and telegram_chat_id is not null)
    );

alter table public.emergency_contacts
  add constraint emergency_contacts_user_telegram_chat_key
    unique (user_id, telegram_chat_id);

alter table public.emergency_deliveries
  drop constraint emergency_deliveries_channel_check,
  add constraint emergency_deliveries_channel_check
    check (channel in ('sms', 'telegram'));

create table public.telegram_link_codes (
  code text primary key check (code ~ '^[A-Z0-9]{8}$'),
  user_id bigint not null unique references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.telegram_link_codes is
  'Codigos breves y temporales para vincular un chat de Telegram con una cuenta VitalWatch.';

alter table public.telegram_link_codes enable row level security;
revoke all on table public.telegram_link_codes from anon, authenticated;
grant all on table public.telegram_link_codes to service_role;

alter table public.devices
  add column connection_status text not null default 'unknown'
    check (connection_status in ('unknown', 'online', 'offline')),
  add column connection_status_changed_at timestamptz;

update public.devices
set connection_status = case
      when last_seen_at >= now() - interval '75 seconds' then 'online'
      when last_seen_at is not null then 'offline'
      else 'unknown'
    end,
    connection_status_changed_at = now();

alter table public.device_events
  add column source_event_id text;

alter table public.device_events
  add constraint device_events_device_source_event_key
    unique (device_id, source_event_id);

-- Se ejecuta cada minuto. Solo crea un evento cuando el estado cambia, por lo
-- que no repite alertas mientras una pulsera continúa desconectada.
create or replace function private.mark_vitalwatch_devices_offline()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  with stale_devices as (
    update public.devices
    set connection_status = 'offline',
        connection_status_changed_at = now()
    where last_seen_at < now() - interval '75 seconds'
      and connection_status <> 'offline'
    returning id, last_seen_at
  ), inserted_events as (
    insert into public.device_events (
      device_id,
      type,
      severity,
      message,
      event_time
    )
    select
      id,
      'device_offline',
      'warning',
      'La pulsera dejo de enviar datos. Ultima comunicacion: ' ||
        to_char(last_seen_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI:SS'),
      now()
    from stale_devices
    returning id
  )
  select count(*)::integer into affected from inserted_events;

  return affected;
end;
$$;

revoke all on function private.mark_vitalwatch_devices_offline() from public;
grant execute on function private.mark_vitalwatch_devices_offline() to service_role;

create extension if not exists pg_cron;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'vitalwatch-monitor-connections';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'vitalwatch-monitor-connections',
    '* * * * *',
    'select private.mark_vitalwatch_devices_offline();'
  );
end
$$;
