-- Incluye la ultima fotografia disponible en el aviso de desconexion. Puede
-- ser antigua, por eso el mensaje conserva tambien la hora de ultima comunicacion.
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
      heart_rate,
      spo2,
      battery_level,
      impact_value,
      event_time
    )
    select
      stale.id,
      'device_offline',
      'warning',
      'La pulsera dejo de enviar datos. Ultima comunicacion: ' ||
        to_char(stale.last_seen_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI:SS'),
      reading.heart_rate,
      reading.spo2,
      reading.battery_level,
      reading.impact_value,
      now()
    from stale_devices stale
    left join lateral (
      select heart_rate, spo2, battery_level, impact_value
      from public.sensor_readings
      where device_id = stale.id
      order by recorded_at desc
      limit 1
    ) reading on true
    returning id
  )
  select count(*)::integer into affected from inserted_events;

  return affected;
end;
$$;

revoke all on function private.mark_vitalwatch_devices_offline() from public;
grant execute on function private.mark_vitalwatch_devices_offline() to service_role;
