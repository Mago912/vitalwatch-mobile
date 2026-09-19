import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

type DeviceEvent = {
  battery_level: number | null;
  device_id: number;
  event_time: string;
  heart_rate: number | null;
  id: number;
  impact_value: number | null;
  message: string;
  severity: string;
  spo2: number | null;
  type: string;
};

type WebhookPayload = {
  old_record: DeviceEvent | null;
  record: DeviceEvent;
  schema: string;
  table: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
};

type ExpoMessage = {
  body: string;
  channelId: string;
  data: Record<string, string | number>;
  priority: 'default' | 'high';
  sound: 'default';
  title: string;
  to: string;
};

type EmergencyContact = {
  id: number;
  name: string;
  telegram_chat_id: number;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export default {
  fetch: withSupabase({ auth: ['secret'] }, async (request, context) => {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Metodo no permitido.' }, 405);
    }

    try {
      const payload: unknown = await request.json();

      return await sendPushFromWebhook(payload, context.supabaseAdmin);
    } catch (error) {
      console.error('send-vitalwatch-push:', getErrorMessage(error));
      return jsonResponse({ error: 'No se pudo procesar la solicitud.' }, 500);
    }
  }),
};

async function sendPushFromWebhook(payload: unknown, supabaseAdmin: any) {
  if (!isWebhookPayload(payload)) {
    return jsonResponse({ error: 'Payload de webhook invalido.' }, 400);
  }

  if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'device_events') {
    return jsonResponse({ ignored: true });
  }

  const event = payload.record;
  const { data: registrations, error: registrationsError } = await supabaseAdmin
    .from('push_tokens')
    .select('expo_push_token')
    .eq('device_id', event.device_id);

  if (registrationsError) {
    throw registrationsError;
  }

  let sent = 0;
  let tickets: unknown[] = [];
  let pushError: string | null = null;

  if (registrations?.length) {
    const notification = getNotificationContent(event);
    const messages: ExpoMessage[] = registrations.map(
      ({ expo_push_token }: { expo_push_token: string }) => ({
        to: expo_push_token,
        sound: 'default',
        channelId: 'vitalwatch-alerts',
        priority: event.severity === 'critical' ? 'high' : 'default',
        title: notification.title,
        body: notification.body,
        data: {
          // VW-NOTIF-04 — Payload minimo y ruta validable por la app.
          event_id: event.id,
          event_type: event.type,
          url: `/event/${event.id}`,
        },
      })
    );

    try {
      const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
      const expoResponse = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      const expoResult = await expoResponse.json();

      if (!expoResponse.ok) {
        pushError = 'Expo rechazo las notificaciones.';
        console.error('Expo Push Service:', expoResult);
      } else {
        sent = messages.length;
        tickets = expoResult.data ?? [];
      }
    } catch (error) {
      pushError = getErrorMessage(error);
      console.error('Expo Push Service:', pushError);
    }
  }

  const emergency = await sendEmergencyTelegram(event, supabaseAdmin);
  return jsonResponse({ sent, tickets, pushError, emergency });
}

async function sendEmergencyTelegram(event: DeviceEvent, supabaseAdmin: any) {
  const telegramEventTypes = new Set([
    'device_offline',
    'fall_detected',
    'heart_rate_abnormal',
    'sos',
    'spo2_low',
  ]);
  if (!telegramEventTypes.has(event.type)) {
    return { configured: false, sent: 0, skipped: 'evento_no_critico' };
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    console.warn('Telegram no configurado; se mantiene el push de Expo.');
    return { configured: false, sent: 0, skipped: 'falta_secret_telegram' };
  }

  const { data: device, error: deviceError } = await supabaseAdmin
    .from('devices')
    .select('user_id')
    .eq('id', event.device_id)
    .maybeSingle();
  if (deviceError) throw deviceError;
  if (!device) return { configured: true, sent: 0, skipped: 'pulsera_no_encontrada' };

  const [{ data: user, error: userError }, { data: contacts, error: contactsError }] =
    await Promise.all([
      supabaseAdmin.from('users').select('name').eq('id', device.user_id).maybeSingle(),
      supabaseAdmin
        .from('emergency_contacts')
        .select('id, name, telegram_chat_id')
        .eq('user_id', device.user_id)
        .eq('active', true)
        .eq('channel', 'telegram')
        .not('telegram_chat_id', 'is', null),
    ]);
  if (userError) throw userError;
  if (contactsError) throw contactsError;

  const body = createTelegramBody(event, user?.name ?? 'Usuario VitalWatch');
  let sent = 0;

  for (const contact of (contacts ?? []) as EmergencyContact[]) {
    const { data: delivery, error: deliveryError } = await supabaseAdmin
      .from('emergency_deliveries')
      .insert({
        event_id: event.id,
        contact_id: contact.id,
        channel: 'telegram',
        status: 'queued',
      })
      .select('id')
      .maybeSingle();

    if (deliveryError?.code === '23505') continue;
    if (deliveryError) throw deliveryError;
    if (!delivery) throw new Error('No se pudo registrar la entrega de emergencia.');

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: contact.telegram_chat_id, text: body }),
        }
      );
      const result = await response.json();

      await supabaseAdmin
        .from('emergency_deliveries')
        .update({
          status: response.ok ? 'sent' : 'failed',
          provider_message_id: response.ok ? String(result.result?.message_id ?? '') : null,
          error_message: response.ok
            ? null
            : result.description ?? `Telegram HTTP ${response.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);

      if (response.ok) sent += 1;
    } catch (error) {
      await supabaseAdmin
        .from('emergency_deliveries')
        .update({
          status: 'failed',
          error_message: getErrorMessage(error),
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);
    }
  }

  return { configured: true, sent, contacts: contacts?.length ?? 0 };
}

function createTelegramBody(event: DeviceEvent, userName: string) {
  const labels: Record<string, string> = {
    device_offline: 'SIN COMUNICACION',
    fall_detected: 'CAIDA CONFIRMADA',
    heart_rate_abnormal: 'FRECUENCIA CARDIACA FUERA DEL RANGO EXPERIMENTAL',
    sos: 'SOS ACTIVADO',
    spo2_low: 'SpO2 BAJA CONFIRMADA',
  };
  const date = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(event.event_time));
  const measurements = [
    event.heart_rate === null ? null : `Frecuencia cardiaca: ${event.heart_rate} lpm`,
    event.spo2 === null ? null : `SpO2: ${event.spo2}%`,
    event.impact_value === null ? null : `Impacto: ${event.impact_value.toFixed(2)} g`,
    event.battery_level === null ? null : `Bateria: ${event.battery_level}%`,
  ].filter(Boolean);

  return [
    `VITALWATCH - ${labels[event.type] ?? 'ALERTA'}`,
    `Usuario: ${userName}`,
    `Fecha y hora: ${date}`,
    event.message.trim(),
    ...measurements,
    'Revisar el estado de la persona.',
  ]
    .filter(Boolean)
    .join('\n');
}

function isWebhookPayload(payload: unknown): payload is WebhookPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const value = payload as Partial<WebhookPayload>;
  const record = value.record as Partial<DeviceEvent> | undefined;

  return (
    value.type === 'INSERT' &&
    value.schema === 'public' &&
    value.table === 'device_events' &&
    typeof record?.id === 'number' &&
    typeof record.device_id === 'number' &&
    typeof record.type === 'string' &&
    typeof record.severity === 'string' &&
    typeof record.message === 'string' &&
    typeof record.event_time === 'string'
  );
}

function getNotificationContent(event: DeviceEvent) {
  // VW-NOTIF-01 — Privacidad de lock screen: el detalle medico, el nombre del
  // contacto y el numero solo se consultan dentro de la sesion autenticada.
  const body =
    event.type === 'message_request'
      ? 'Tenes un nuevo mensaje.'
      : event.type === 'call_request'
        ? 'Hay una nueva solicitud de llamada. Toca para verla.'
        : 'Hay una nueva alerta. Toca para verla.';
  return {
    title: 'VitalWatch',
    body,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
