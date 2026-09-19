alter table public.devices
  add column if not exists alert_ack_requested_at timestamptz,
  add column if not exists reported_alert_active boolean not null default false,
  add column if not exists reported_alert_kind text,
  add column if not exists alert_reported_at timestamptz;

alter table public.devices
  drop constraint if exists devices_reported_alert_kind_check,
  add constraint devices_reported_alert_kind_check
    check (
      reported_alert_kind is null or
      reported_alert_kind in ('fall', 'sos')
    );

comment on column public.devices.alert_ack_requested_at is
  'Orden de la aplicacion para cerrar la alerta critica que esta activa.';

comment on column public.devices.reported_alert_active is
  'Indica si el ESP32 confirma una alerta critica visible en la TFT.';

comment on column public.devices.reported_alert_kind is
  'Tipo de alerta critica confirmado por el ESP32: fall o sos.';

comment on column public.devices.alert_reported_at is
  'Fecha del ultimo estado de alerta confirmado por el ESP32.';

-- La app solo solicita el cierre. El estado reportado se reserva para la Edge
-- Function autenticada con la credencial privada del ESP32.
grant update (alert_ack_requested_at)
on public.devices to authenticated;
