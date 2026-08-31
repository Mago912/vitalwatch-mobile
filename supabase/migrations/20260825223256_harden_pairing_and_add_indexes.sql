create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_vitalwatch_user(target_user_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = target_user_id
      and auth_user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_vitalwatch_user(bigint) from public;
grant execute on function private.is_vitalwatch_user(bigint) to authenticated;

drop policy if exists users_read_own on public.users;
drop policy if exists devices_read_own on public.devices;
drop policy if exists readings_read_own on public.sensor_readings;
drop policy if exists events_read_own on public.device_events;
drop policy if exists medications_read_own on public.medications;
drop policy if exists medications_insert_own on public.medications;
drop policy if exists medications_update_own on public.medications;
drop policy if exists medications_delete_own on public.medications;
drop policy if exists medication_logs_read_own on public.medication_logs;
drop policy if exists medication_logs_insert_own on public.medication_logs;

create policy users_read_own
on public.users for select to authenticated
using (private.is_vitalwatch_user(id));

create policy devices_read_own
on public.devices for select to authenticated
using (private.is_vitalwatch_user(user_id));

create policy readings_read_own
on public.sensor_readings for select to authenticated
using (
  exists (
    select 1 from public.devices d
    where d.id = sensor_readings.device_id
      and private.is_vitalwatch_user(d.user_id)
  )
);

create policy events_read_own
on public.device_events for select to authenticated
using (
  exists (
    select 1 from public.devices d
    where d.id = device_events.device_id
      and private.is_vitalwatch_user(d.user_id)
  )
);

create policy medications_read_own
on public.medications for select to authenticated
using (private.is_vitalwatch_user(user_id));

create policy medications_insert_own
on public.medications for insert to authenticated
with check (private.is_vitalwatch_user(user_id));

create policy medications_update_own
on public.medications for update to authenticated
using (private.is_vitalwatch_user(user_id))
with check (private.is_vitalwatch_user(user_id));

create policy medications_delete_own
on public.medications for delete to authenticated
using (private.is_vitalwatch_user(user_id));

create policy medication_logs_read_own
on public.medication_logs for select to authenticated
using (
  exists (
    select 1 from public.medications m
    where m.id = medication_logs.medication_id
      and private.is_vitalwatch_user(m.user_id)
  )
);

create policy medication_logs_insert_own
on public.medication_logs for insert to authenticated
with check (
  source = 'mobile_app'
  and status in ('pending', 'taken')
  and exists (
    select 1
    from public.medications m
    join public.devices d on d.user_id = m.user_id
    where m.id = medication_logs.medication_id
      and d.id = medication_logs.device_id
      and private.is_vitalwatch_user(m.user_id)
  )
);

drop function if exists public.is_vitalwatch_user(bigint);
drop function if exists public.pair_vitalwatch_device(text, text);

create or replace function public.pair_vitalwatch_device_admin(
  requested_auth_user uuid,
  requested_device_code text,
  requested_pairing_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_device_id bigint;
  selected_user_id bigint;
  linked_auth_user uuid;
begin
  select d.id, d.user_id, u.auth_user_id
  into selected_device_id, selected_user_id, linked_auth_user
  from public.devices d
  join public.users u on u.id = d.user_id
  where d.device_code = trim(requested_device_code)
    and d.pairing_code_hash = requested_pairing_hash
  for update of d, u;

  if selected_device_id is null then
    return false;
  end if;

  if linked_auth_user is not null and linked_auth_user <> requested_auth_user then
    raise exception 'La pulsera ya esta vinculada a otra cuenta.';
  end if;

  update public.users
  set auth_user_id = requested_auth_user
  where id = selected_user_id;

  update public.devices
  set pairing_code_hash = null,
      paired_at = now()
  where id = selected_device_id;

  return true;
end;
$$;

revoke all on function public.pair_vitalwatch_device_admin(uuid, text, text) from public;
grant execute on function public.pair_vitalwatch_device_admin(uuid, text, text) to service_role;

create index if not exists devices_user_id_idx on public.devices(user_id);
create index if not exists sensor_readings_device_id_idx on public.sensor_readings(device_id);
create index if not exists device_events_device_id_idx on public.device_events(device_id);
create index if not exists medications_user_id_idx on public.medications(user_id);
create index if not exists medication_logs_medication_id_idx on public.medication_logs(medication_id);
create index if not exists medication_logs_device_id_idx on public.medication_logs(device_id);

;
