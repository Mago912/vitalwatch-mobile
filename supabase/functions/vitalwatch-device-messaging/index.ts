import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';

type MessagingPayload = {
  action: 'list' | 'request';
  contactId?: number;
  deviceCode: string;
  eventId?: string;
  eventOccurredAt?: number;
  eventType?: 'MESSAGE_REQUEST' | 'CALL_REQUEST';
};

type DeviceRow = {
  device_token_hash: string | null;
  id: number;
  user_id: number;
};

export default {
  fetch: withSupabase({ auth: ['publishable'] }, async (request, context) => {
    if (request.method !== 'POST') return jsonResponse({ error: 'Metodo no permitido.' }, 405);

    try {
      const payload: unknown = await request.json();
      if (!isMessagingPayload(payload)) {
        return jsonResponse({ error: 'Solicitud de mensajeria invalida.' }, 400);
      }

      const device = await authenticateDevice(
        context.supabaseAdmin,
        payload.deviceCode,
        request.headers.get('x-device-token')
      );
      if (device instanceof Response) return device;

      if (payload.action === 'list') {
        // VW-SUPA-02 — Contrato minimizado para el ESP32: solo ID y nombre.
        // phone_e164 se usa como filtro de capacidad, pero nunca se devuelve.
        const { data, error } = await context.supabaseAdmin
          .from('emergency_contacts')
          .select('id, name')
          .eq('user_id', device.user_id)
          .eq('channel', 'sms')
          .eq('active', true)
          .not('phone_e164', 'is', null)
          .order('name', { ascending: true })
          .limit(8);
        if (error) throw error;

        return jsonResponse({
          contacts: (data ?? []).map((contact: { id: number; name: string }) => ({
            displayName: contact.name,
            id: String(contact.id),
          })),
          syncedAt: new Date().toISOString(),
        });
      }

      const contactId = payload.contactId!;
      const { data: contact, error: contactError } = await context.supabaseAdmin
        .from('emergency_contacts')
        .select('id')
        .eq('id', contactId)
        .eq('user_id', device.user_id)
        .eq('channel', 'sms')
        .eq('active', true)
        .not('phone_e164', 'is', null)
        .maybeSingle();
      if (contactError) throw contactError;
      if (!contact) return jsonResponse({ error: 'Contacto no autorizado o inactivo.' }, 403);

      const eventType = payload.eventType === 'CALL_REQUEST' ? 'call_request' : 'message_request';
      const eventTime = payload.eventOccurredAt
        ? new Date(payload.eventOccurredAt * 1000).toISOString()
        : new Date().toISOString();
      const eventRow = {
        contact_id: contact.id,
        device_id: device.id,
        event_time: eventTime,
        message:
          eventType === 'call_request'
            ? 'Solicitud de llamada desde la pulsera.'
            : 'Solicitud de mensaje desde la pulsera.',
        severity: 'info',
        source_event_id: payload.eventId,
        type: eventType,
      };

      // VW-SEC-02 — source_event_id + device_id ya tiene una clave unica. Los
      // reintentos del ESP32 quedan aceptados sin crear acciones duplicadas.
      const { error: eventError } = await context.supabaseAdmin
        .from('device_events')
        .upsert(eventRow, {
          ignoreDuplicates: true,
          onConflict: 'device_id,source_event_id',
        });
      if (eventError) throw eventError;

      return jsonResponse({ accepted: true, eventId: payload.eventId, status: 'queued' });
    } catch (error) {
      console.error('vitalwatch-device-messaging:', getErrorMessage(error));
      return jsonResponse({ error: 'No se pudo procesar la mensajeria de la pulsera.' }, 500);
    }
  }),
};

async function authenticateDevice(
  supabaseAdmin: any,
  deviceCode: string,
  receivedToken: string | null
): Promise<DeviceRow | Response> {
  const { data, error } = await supabaseAdmin
    .from('devices')
    .select('id, user_id, device_token_hash')
    .eq('device_code', deviceCode.trim())
    .maybeSingle();
  if (error) throw error;
  if (!data?.device_token_hash) return jsonResponse({ error: 'Pulsera no registrada.' }, 404);

  if (!receivedToken || !safeEqual(await sha256(receivedToken), data.device_token_hash)) {
    return jsonResponse({ error: 'Credencial de pulsera invalida.' }, 401);
  }
  return data as DeviceRow;
}

function isMessagingPayload(payload: unknown): payload is MessagingPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<MessagingPayload>;
  if (
    (value.action !== 'list' && value.action !== 'request') ||
    typeof value.deviceCode !== 'string' ||
    value.deviceCode.trim().length === 0 ||
    value.deviceCode.length > 100
  ) {
    return false;
  }
  if (value.action === 'list') return true;

  return (
    Number.isInteger(value.contactId) &&
    Number(value.contactId) > 0 &&
    (value.eventType === 'MESSAGE_REQUEST' || value.eventType === 'CALL_REQUEST') &&
    typeof value.eventId === 'string' &&
    value.eventId.length >= 8 &&
    value.eventId.length <= 100 &&
    (value.eventOccurredAt === undefined ||
      (Number.isInteger(value.eventOccurredAt) &&
        Number(value.eventOccurredAt) >= 1_700_000_000 &&
        Number(value.eventOccurredAt) <= Date.now() / 1000 + 300))
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
