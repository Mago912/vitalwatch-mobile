create extension if not exists pgcrypto with schema extensions;

alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

alter table public.devices
  add column if not exists device_token_hash text,
  add column if not exists pairing_code_hash text,
  add column if not exists paired_at timestamptz;

update public.devices
set
  device_token_hash = 'aa6022e3a5d3d5b8fb3c9d3e56f35ca227289f817d056b491b3d6df0ef707f31',
  pairing_code_hash = '324adae39d44f744b4e0a8d02ff8c3d956bdb8a2124989aa5d2f8adc61fc1d06'
where device_code = 'VW-001';

create or replace function public.is_vitalwatch_user(target_user_id bigint)
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

revoke all on function public.is_vitalwatch_user(bigint) from public;
grant execute on function public.is_vitalwatch_user(bigint) to authenticated;

create or replace function public.pair_vitalwatch_device(
  requested_device_code text,
  requested_pairing_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_auth_user uuid := (select auth.uid());
  selected_device_id bigint;
  selected_user_id bigint;
  linked_auth_user uuid;
begin
  if current_auth_user is null then
    raise exception 'Debes iniciar sesion para vincular la pulsera.';
  end if;

  select d.id, d.user_id, u.auth_user_id
  into selected_device_id, selected_user_id, linked_auth_user
  from public.devices d
  join public.users u on u.id = d.user_id
  where d.device_code = trim(requested_device_code)
    and d.pairing_code_hash = encode(
      extensions.digest(upper(trim(requested_pairing_code)), 'sha256'),
      'hex'
    )
  for update of d, u;

  if selected_device_id is null then
    return false;
  end if;

  if linked_auth_user is not null and linked_auth_user <> current_auth_user then
    raise exception 'La pulsera ya esta vinculada a otra cuenta.';
  end if;

  update public.users
  set auth_user_id = current_auth_user
  where id = selected_user_id;

  update public.devices
  set pairing_code_hash = null,
      paired_at = now()
  where id = selected_device_id;

  return true;
end;
$$;

revoke all on function public.pair_vitalwatch_device(text, text) from public;
grant execute on function public.pair_vitalwatch_device(text, text) to authenticated;

drop policy if exists demo_read_users on public.users;
drop policy if exists demo_read_devices on public.devices;
drop policy if exists demo_read_sensor_readings on public.sensor_readings;
drop policy if exists demo_read_device_events on public.device_events;
drop policy if exists demo_read_medications on public.medications;
drop policy if exists demo_read_medication_logs on public.medication_logs;

create policy users_read_own
on public.users for select to authenticated
using (public.is_vitalwatch_user(id));

create policy devices_read_own
on public.devices for select to authenticated
using (public.is_vitalwatch_user(user_id));

create policy readings_read_own
on public.sensor_readings for select to authenticated
using (
  exists (
    select 1 from public.devices d
    where d.id = sensor_readings.device_id
      and public.is_vitalwatch_user(d.user_id)
  )
);

create policy events_read_own
on public.device_events for select to authenticated
using (
  exists (
    select 1 from public.devices d
    where d.id = device_events.device_id
      and public.is_vitalwatch_user(d.user_id)
  )
);

create policy medications_read_own
on public.medications for select to authenticated
using (public.is_vitalwatch_user(user_id));

create policy medications_insert_own
on public.medications for insert to authenticated
with check (public.is_vitalwatch_user(user_id));

create policy medications_update_own
on public.medications for update to authenticated
using (public.is_vitalwatch_user(user_id))
with check (public.is_vitalwatch_user(user_id));

create policy medications_delete_own
on public.medications for delete to authenticated
using (public.is_vitalwatch_user(user_id));

create policy medication_logs_read_own
on public.medication_logs for select to authenticated
using (
  exists (
    select 1 from public.medications m
    where m.id = medication_logs.medication_id
      and public.is_vitalwatch_user(m.user_id)
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
      and public.is_vitalwatch_user(m.user_id)
  )
);

revoke all on public.users, public.devices, public.sensor_readings,
  public.device_events, public.medications, public.medication_logs from anon;

grant select on public.users, public.devices, public.sensor_readings,
  public.device_events to authenticated;
grant select, insert, update, delete on public.medications to authenticated;
grant select, insert on public.medication_logs to authenticated;

