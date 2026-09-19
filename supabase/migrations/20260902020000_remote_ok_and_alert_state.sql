alter table public.devices
  add column if not exists desired_input_action text,
  add column if not exists input_command_at timestamptz,
  add column if not exists input_reported_at timestamptz,
  add column if not exists reported_alert_state text not null default 'none',
  add column if not exists alert_reported_at timestamptz;

alter table public.devices
  drop constraint if exists devices_desired_input_action_check,
  add constraint devices_desired_input_action_check
    check (desired_input_action is null or desired_input_action = 'ok'),
  drop constraint if exists devices_reported_alert_state_check,
  add constraint devices_reported_alert_state_check
    check (reported_alert_state in ('none', 'fall', 'sos'));

comment on column public.devices.desired_input_action is
  'Entrada física virtual solicitada desde la app. En 1.0.4 admite OK.';
comment on column public.devices.input_command_at is
  'Fecha de servidor de la última entrada virtual solicitada.';
comment on column public.devices.input_reported_at is
  'Fecha en que BIOSYS confirmó haber procesado la entrada virtual.';
comment on column public.devices.reported_alert_state is
  'Alerta actualmente visible en la TFT: none, fall o sos.';
comment on column public.devices.alert_reported_at is
  'Fecha de confirmación del estado de alerta por BIOSYS.';

create or replace function public.stamp_vitalwatch_input_command()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.input_command_at is distinct from old.input_command_at then
    new.input_command_at = clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_vitalwatch_input_command_at on public.devices;
create trigger stamp_vitalwatch_input_command_at
before update of input_command_at on public.devices
for each row execute function public.stamp_vitalwatch_input_command();

grant update (desired_input_action, input_command_at)
on public.devices to authenticated;
