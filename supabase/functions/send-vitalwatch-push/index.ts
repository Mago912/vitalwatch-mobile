import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

type DeviceEvent = {
  device_id: number;
  id: number;
  message: string;
  severity: string;
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

  if (!registrations?.length) {
    return jsonResponse({ sent: 0 });
  }

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
        deviceId: event.device_id,
        eventId: event.id,
        eventType: event.type,
      },
    })
  );

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
    console.error('Expo Push Service:', expoResult);
    return jsonResponse({ error: 'Expo rechazo las notificaciones.' }, 502);
  }

  return jsonResponse({ sent: messages.length, tickets: expoResult.data ?? [] });
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
    typeof record.message === 'string'
  );
}

function getNotificationContent(event: DeviceEvent) {
  const titles: Record<string, string> = {
    battery_low: 'Bateria baja',
    fall_detected: 'Posible caida detectada',
    heart_rate_high: 'Ritmo cardiaco alto',
    medication_pending: 'Medicacion pendiente',
    medication_taken: 'Medicacion tomada',
    normal_status: 'VitalWatch',
    sos: 'SOS activado',
    spo2_low: 'Oxigeno bajo',
  };

  return {
    title: titles[event.type] ?? 'Alerta VitalWatch',
    body: event.message.trim() || 'Se registro un nuevo evento en la pulsera.',
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
