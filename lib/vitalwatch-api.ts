import { DeviceAlertState, DeviceDisplayView } from '@/constants/vitalwatch';
import { supabase } from '@/lib/supabase';

export type DashboardEvent = {
  contactId: number | null;
  eventTime: string;
  id: number;
  message: string;
  severity: string;
  type: string;
};

export type DeviceEventDetail = DashboardEvent & {
  contact: {
    active: boolean;
    name: string;
    phoneNumber: string | null;
  } | null;
};

export type DashboardSnapshot = {
  device: {
    battery: number | null;
    alertReportedAt: string | null;
    code: string;
    displayCommandAt: string | null;
    displayReportedAt: string | null;
    desiredDisplayOn: boolean;
    desiredDisplayView: DeviceDisplayView;
    id: number;
    name: string;
    reportedAlertState: DeviceAlertState | null;
    reportedDisplayOn: boolean | null;
    reportedDisplayView: DeviceDisplayView | null;
  };
  events: DashboardEvent[];
  latestReading: {
    battery: number | null;
    heartRate: number | null;
    impact: number | null;
    oxygen: number | null;
    recordedAt: string;
  } | null;
  user: {
    contactName: string;
    id: number;
    name: string;
  };
};

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const userResult = await supabase
    .from('users')
    .select('id, name, responsible_contact')
    .limit(1)
    .maybeSingle();

  if (userResult.error) {
    throw new Error(`No se pudo leer users: ${userResult.error.message}`);
  }

  if (!userResult.data) {
    throw new Error('Esta cuenta todavia no tiene un usuario VitalWatch vinculado.');
  }

  const userId = userResult.data.id;
  const deviceResult = await supabase
    .from('devices')
    .select(
      'id, name, device_code, current_battery, desired_display_on, desired_display_view, reported_display_on, reported_display_view, display_command_at, display_reported_at, reported_alert_state, alert_reported_at'
    )
    .eq('user_id', userId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (deviceResult.error) {
    throw new Error(`No se pudo leer devices: ${deviceResult.error.message}`);
  }

  if (!deviceResult.data) {
    throw new Error('Esta cuenta no tiene una pulsera disponible.');
  }

  const deviceId = deviceResult.data.id;
  const [readingResult, eventsResult] = await Promise.all([
    supabase
      .from('sensor_readings')
      .select('heart_rate, spo2, battery_level, impact_value, recorded_at')
      .eq('device_id', deviceId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('device_events')
      .select('id, type, severity, message, event_time, contact_id')
      .eq('device_id', deviceId)
      .order('event_time', { ascending: false })
      .limit(40),
  ]);

  if (readingResult.error) {
    throw new Error(`No se pudo leer sensor_readings: ${readingResult.error.message}`);
  }

  if (eventsResult.error) {
    throw new Error(`No se pudo leer device_events: ${eventsResult.error.message}`);
  }

  const reading = readingResult.data;

  return {
    user: {
      id: userResult.data.id,
      name: userResult.data.name,
      contactName: userResult.data.responsible_contact ?? '',
    },
    device: {
      id: deviceResult.data.id,
      name: deviceResult.data.name,
      code: deviceResult.data.device_code,
      battery: toOptionalNumber(deviceResult.data.current_battery),
      alertReportedAt: deviceResult.data.alert_reported_at ?? null,
      desiredDisplayOn: deviceResult.data.desired_display_on ?? true,
      desiredDisplayView: toDisplayView(deviceResult.data.desired_display_view) ?? 'menu',
      reportedDisplayOn: deviceResult.data.reported_display_on ?? null,
      reportedDisplayView: toDisplayView(deviceResult.data.reported_display_view),
      reportedAlertState: toAlertState(deviceResult.data.reported_alert_state),
      displayCommandAt: deviceResult.data.display_command_at ?? null,
      displayReportedAt: deviceResult.data.display_reported_at ?? null,
    },
    latestReading: reading
      ? {
          heartRate: toOptionalNumber(reading.heart_rate),
          oxygen: toOptionalNumber(reading.spo2),
          battery: toOptionalNumber(reading.battery_level),
          impact: toOptionalNumber(reading.impact_value),
          recordedAt: reading.recorded_at,
        }
      : null,
    events: (eventsResult.data ?? []).map((event) => ({
      contactId: event.contact_id,
      id: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      eventTime: event.event_time,
    })),
  };
}

// VW-APP-04 — El detalle se vuelve a consultar dentro de una sesion valida.
// El payload push solo transporta el ID; RLS decide si el usuario puede leerlo.
export async function fetchDeviceEventDetail(eventId: number): Promise<DeviceEventDetail> {
  if (!Number.isInteger(eventId) || eventId <= 0) throw new Error('Evento invalido.');

  const { data: event, error } = await supabase
    .from('device_events')
    .select('id, type, severity, message, event_time, contact_id')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el evento: ${error.message}`);
  if (!event) throw new Error('El evento no existe o no pertenece a esta cuenta.');

  let contact: DeviceEventDetail['contact'] = null;
  if (event.contact_id !== null) {
    const { data: contactRow, error: contactError } = await supabase
      .from('emergency_contacts')
      .select('name, phone_e164, active')
      .eq('id', event.contact_id)
      .maybeSingle();

    if (contactError) throw new Error(`No se pudo leer el contacto: ${contactError.message}`);
    if (contactRow) {
      contact = {
        active: contactRow.active,
        name: contactRow.name,
        phoneNumber: contactRow.phone_e164,
      };
    }
  }

  return {
    contact,
    contactId: event.contact_id,
    eventTime: event.event_time,
    id: event.id,
    message: event.message,
    severity: event.severity,
    type: event.type,
  };
}

function toDisplayView(value: unknown): DeviceDisplayView | null {
  if (
    value === 'menu' ||
    value === 'vitals' ||
    value === 'movement' ||
    value === 'status' ||
    value === 'medication'
  ) {
    return value;
  }

  return null;
}

function toOptionalNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toAlertState(value: unknown): DeviceAlertState | null {
  if (value === 'none' || value === 'fall' || value === 'sos') {
    return value;
  }

  return null;
}
