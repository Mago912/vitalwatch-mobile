alter table public.devices
  add column if not exists desired_display_view text not null default 'menu',
  add column if not exists reported_display_view text;

alter table public.devices
  drop constraint if exists devices_desired_display_view_check,
  add constraint devices_desired_display_view_check
    check (desired_display_view in ('menu', 'vitals', 'movement', 'status', 'medication')),
  drop constraint if exists devices_reported_display_view_check,
  add constraint devices_reported_display_view_check
    check (
      reported_display_view is null or
      reported_display_view in ('menu', 'vitals', 'movement', 'status', 'medication')
    );

comment on column public.devices.desired_display_view is
  'Vista de la TFT solicitada por la aplicacion.';
comment on column public.devices.reported_display_view is
  'Ultima vista de la TFT confirmada por el ESP32.';

-- La app elige la vista deseada. La vista confirmada queda reservada para la
-- Edge Function autenticada con la credencial privada del dispositivo.
grant update (desired_display_view)
on public.devices to authenticated;
