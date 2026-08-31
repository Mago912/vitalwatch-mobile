alter table public.devices
  add column if not exists desired_display_on boolean not null default true,
  add column if not exists display_command_at timestamptz not null default now(),
  add column if not exists reported_display_on boolean,
  add column if not exists display_reported_at timestamptz;

comment on column public.devices.desired_display_on is
  'Estado de pantalla solicitado por la aplicacion.';
comment on column public.devices.reported_display_on is
  'Ultimo estado de pantalla confirmado por el ESP32.';

drop policy if exists devices_update_display_own on public.devices;

create policy devices_update_display_own
on public.devices for update to authenticated
using ((select private.is_vitalwatch_user(user_id)))
with check ((select private.is_vitalwatch_user(user_id)));

-- La app solamente puede cambiar la orden y su fecha. El estado reportado se
-- reserva para la Edge Function autenticada con el token privado del ESP32.
revoke update on public.devices from anon, authenticated;
grant update (desired_display_on, display_command_at)
on public.devices to authenticated;
