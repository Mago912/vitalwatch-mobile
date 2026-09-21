import { readFile } from 'node:fs/promises';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY.');
}

const config = await readFile(
  'esp32/VitalWatch_BIOSYS_1_0_9/vitalwatch_config.h',
  'utf8',
);
const tokenMatch = config.match(/DEVICE_TOKEN\s*=\s*"([^"]+)"/);

if (!tokenMatch) {
  throw new Error(
    'No se encontro DEVICE_TOKEN en esp32/VitalWatch_BIOSYS_1_0_9/vitalwatch_config.h.',
  );
}

const deviceToken = tokenMatch[1];
const baseHeaders = {
  apikey: publishableKey,
  'Content-Type': 'application/json',
};

const anonymousDatabase = await fetch(`${supabaseUrl}/rest/v1/medications?select=id&limit=1`, {
  headers: { apikey: publishableKey },
});
const anonymousEmergencyContacts = await fetch(
  `${supabaseUrl}/rest/v1/emergency_contacts?select=id&limit=1`,
  { headers: { apikey: publishableKey } },
);

const anonymousDisplayControl = await fetch(
  `${supabaseUrl}/rest/v1/devices?device_code=eq.VW-001`,
  {
    method: 'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ desired_display_view: 'status' }),
  },
);

const pairingWithoutSession = await fetch(
  `${supabaseUrl}/functions/v1/pair-vitalwatch-device`,
  {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ deviceCode: 'VW-001', pairingCode: 'codigo-invalido' }),
  }
);

const wrongDeviceToken = await fetch(
  `${supabaseUrl}/functions/v1/vitalwatch-device-medications`,
  {
    method: 'POST',
    headers: { ...baseHeaders, 'x-device-token': 'token-incorrecto' },
    body: JSON.stringify({ action: 'list', deviceCode: 'VW-001' }),
  }
);

const validDeviceToken = await fetch(
  `${supabaseUrl}/functions/v1/vitalwatch-device-medications`,
  {
    method: 'POST',
    headers: { ...baseHeaders, 'x-device-token': deviceToken },
    body: JSON.stringify({ action: 'list', deviceCode: 'VW-001' }),
  }
);
const validDeviceBody = await validDeviceToken.json().catch(() => ({}));
const fastDisplayControl = await fetch(
  `${supabaseUrl}/functions/v1/vitalwatch-device-medications`,
  {
    method: 'POST',
    headers: { ...baseHeaders, 'x-device-token': deviceToken },
    body: JSON.stringify({ action: 'control', deviceCode: 'VW-001' }),
  }
);
const fastDisplayBody = await fastDisplayControl.json().catch(() => ({}));
const validDisplayViews = ['menu', 'vitals', 'movement', 'status', 'medication'];
const displayControlIsValid =
  typeof validDeviceBody?.control?.displayOn === 'boolean' &&
  validDisplayViews.includes(validDeviceBody?.control?.displayView);
const fastDisplayControlIsValid =
  fastDisplayControl.ok &&
  typeof fastDisplayBody?.control?.displayOn === 'boolean' &&
  validDisplayViews.includes(fastDisplayBody?.control?.displayView) &&
  fastDisplayBody.medications === undefined;
const medicationDatesAreValid =
  Array.isArray(validDeviceBody.medications) &&
  validDeviceBody.medications.every((medication) => /^\d{4}-\d{2}-\d{2}$/.test(medication.date));
const medicationReminderContractIsValid =
  Array.isArray(validDeviceBody.medications) &&
  validDeviceBody.medications.every((medication) => typeof medication.reminderDue === 'boolean');
const medicationDaysContractIsValid =
  Array.isArray(validDeviceBody.medications) &&
  validDeviceBody.medications.every(
    (medication) =>
      Array.isArray(medication.days) &&
      medication.days.length > 0 &&
      medication.days.every(
        (day) => Number.isInteger(day) && day >= 1 && day <= 7
      )
  );

const wrongTelemetryToken = await fetch(
  `${supabaseUrl}/functions/v1/vitalwatch-device-telemetry`,
  {
    method: 'POST',
    headers: { ...baseHeaders, 'x-device-token': 'token-incorrecto' },
    body: JSON.stringify({ deviceCode: 'VW-001', impactValue: 1 }),
  }
);

// VW-SEC-03 — Verifica credencial, minimizacion y rechazo de un contact_id
// manipulado sin insertar una solicitud valida.
const wrongMessagingToken = await fetch(
  `${supabaseUrl}/functions/v1/vitalwatch-device-messaging`,
  {
    method: 'POST',
    headers: { ...baseHeaders, 'x-device-token': 'token-incorrecto' },
    body: JSON.stringify({ action: 'list', deviceCode: 'VW-001' }),
  }
);
const validMessagingList = await fetch(
  `${supabaseUrl}/functions/v1/vitalwatch-device-messaging`,
  {
    method: 'POST',
    headers: { ...baseHeaders, 'x-device-token': deviceToken },
    body: JSON.stringify({ action: 'list', deviceCode: 'VW-001' }),
  }
);
const validMessagingBody = await validMessagingList.json().catch(() => ({}));
const messagingPayloadIsMinimal =
  Array.isArray(validMessagingBody.contacts) &&
  validMessagingBody.contacts.every(
    (contact) =>
      typeof contact.id === 'string' &&
      typeof contact.displayName === 'string' &&
      !('phoneNumber' in contact) &&
      !('phone_e164' in contact)
  );
const manipulatedContact = await fetch(
  `${supabaseUrl}/functions/v1/vitalwatch-device-messaging`,
  {
    method: 'POST',
    headers: { ...baseHeaders, 'x-device-token': deviceToken },
    body: JSON.stringify({
      action: 'request',
      contactId: 2147483647,
      deviceCode: 'VW-001',
      eventId: 'security-invalid-contact',
      eventType: 'CALL_REQUEST',
    }),
  }
);

const pushWithoutSession = await fetch(
  `${supabaseUrl}/functions/v1/register-vitalwatch-push`,
  {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ action: 'register' }),
  }
);

const telegramLinkWithoutSession = await fetch(
  `${supabaseUrl}/functions/v1/create-telegram-link`,
  {
    method: 'POST',
    headers: baseHeaders,
  }
);

const telegramWebhookWithoutSecret = await fetch(
  `${supabaseUrl}/functions/v1/telegram-vitalwatch-bot`,
  {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({}),
  }
);

const webhookWithPublicKey = await fetch(`${supabaseUrl}/functions/v1/send-vitalwatch-push`, {
  method: 'POST',
  headers: baseHeaders,
  body: JSON.stringify({}),
});

const checks = [
  ['Base de datos sin sesion', !anonymousDatabase.ok, anonymousDatabase.status],
  ['Contactos sin sesion', !anonymousEmergencyContacts.ok, anonymousEmergencyContacts.status],
  ['Control TFT sin sesion', !anonymousDisplayControl.ok, anonymousDisplayControl.status],
  ['Vinculacion sin sesion', !pairingWithoutSession.ok, pairingWithoutSession.status],
  ['ESP32 con token incorrecto', !wrongDeviceToken.ok, wrongDeviceToken.status],
  ['ESP32 con token correcto', validDeviceToken.ok, validDeviceToken.status],
  ['Contrato de control TFT', displayControlIsValid, validDeviceToken.status],
  ['Control TFT rapido', fastDisplayControlIsValid, fastDisplayControl.status],
  ['Fecha programada de medicamentos', medicationDatesAreValid, validDeviceToken.status],
  ['Dias semanales de medicamentos', medicationDaysContractIsValid, validDeviceToken.status],
  ['Recordatorio para TFT', medicationReminderContractIsValid, validDeviceToken.status],
  ['Telemetria con token incorrecto', !wrongTelemetryToken.ok, wrongTelemetryToken.status],
  ['Mensajeria con token incorrecto', !wrongMessagingToken.ok, wrongMessagingToken.status],
  ['Lista de mensajeria con token correcto', validMessagingList.ok, validMessagingList.status],
  ['Payload de contactos minimizado', messagingPayloadIsMinimal, validMessagingList.status],
  ['contact_id manipulado rechazado', manipulatedContact.status === 403, manipulatedContact.status],
  ['Registro push sin sesion', !pushWithoutSession.ok, pushWithoutSession.status],
  ['Vinculacion Telegram sin sesion', !telegramLinkWithoutSession.ok, telegramLinkWithoutSession.status],
  ['Webhook Telegram sin secreto', !telegramWebhookWithoutSecret.ok, telegramWebhookWithoutSecret.status],
  ['Webhook con clave publica', !webhookWithPublicKey.ok, webhookWithPublicKey.status],
];

for (const [name, passed, status] of checks) {
  console.log(`${passed ? 'OK' : 'FALLO'} | ${name} | HTTP ${status}`);
}

if (validDeviceToken.ok) {
  const count = Array.isArray(validDeviceBody.medications) ? validDeviceBody.medications.length : 0;
  console.log(`OK | Medicamentos visibles para VW-001: ${count}`);
} else {
  console.log(`DETALLE | ESP32: ${validDeviceBody.error ?? 'sin detalle'}`);
}

if (checks.some(([, passed]) => !passed)) {
  process.exitCode = 1;
}
