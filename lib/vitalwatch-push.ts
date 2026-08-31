import { Platform } from 'react-native';

import { supabase, supabaseKey, supabaseUrl } from '@/lib/supabase';

type RegisterDevicePushTokenInput = {
  deviceCode: string;
  expoPushToken: string;
};

export async function registerDevicePushToken({
  deviceCode,
  expoPushToken,
}: RegisterDevicePushTokenInput) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error('Las notificaciones push remotas solo funcionan en Android o iOS.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    throw new Error('Debes iniciar sesion para registrar las notificaciones.');
  }

  try {
    response = await fetch(`${supabaseUrl}/functions/v1/register-vitalwatch-push`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'register',
        deviceCode,
        expoPushToken,
        platform: Platform.OS,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Supabase no respondio en 15 segundos. Revisa la conexion a Internet.');
    }

    throw new Error(
      `No se pudo conectar con Supabase: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : `Error HTTP ${response.status}`;
    throw new Error(`No se pudo registrar el celular: ${message}`);
  }
}
