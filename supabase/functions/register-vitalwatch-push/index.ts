import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type RegisterPayload = {
  action: 'register';
  deviceCode: string;
  expoPushToken: string;
  platform: 'android' | 'ios';
};

const EXPO_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido.' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Sesion requerida.' }, 401);
    }

    const supabaseUrl = requireEnvironment('SUPABASE_URL');
    const serviceRoleKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const jwt = authorization.slice('Bearer '.length);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !authData.user) {
      return jsonResponse({ error: 'Sesion invalida.' }, 401);
    }

    const payload: unknown = await request.json();
    if (!isRegisterPayload(payload)) {
      return jsonResponse({ error: 'Datos de registro invalidos.' }, 400);
    }

    const { data: vitalwatchUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!vitalwatchUser) {
      return jsonResponse({ error: 'La cuenta no tiene una pulsera vinculada.' }, 403);
    }

    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .select('id')
      .eq('device_code', payload.deviceCode.trim())
      .eq('user_id', vitalwatchUser.id)
      .maybeSingle();

    if (deviceError) {
      throw deviceError;
    }

    if (!device) {
      return jsonResponse({ error: 'La pulsera no pertenece a esta cuenta.' }, 403);
    }

    const now = new Date().toISOString();
    const { error: tokenError } = await supabaseAdmin.from('push_tokens').upsert(
      {
        device_id: device.id,
        expo_push_token: payload.expoPushToken,
        platform: payload.platform,
        updated_at: now,
      },
      { onConflict: 'expo_push_token' }
    );

    if (tokenError) {
      throw tokenError;
    }

    return jsonResponse({ registered: true });
  } catch (error) {
    console.error('register-vitalwatch-push:', getErrorMessage(error));
    return jsonResponse({ error: 'No se pudo registrar el celular.' }, 500);
  }
});

function isRegisterPayload(payload: unknown): payload is RegisterPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const value = payload as Partial<RegisterPayload>;
  return (
    value.action === 'register' &&
    typeof value.deviceCode === 'string' &&
    value.deviceCode.trim().length > 0 &&
    value.deviceCode.length <= 100 &&
    typeof value.expoPushToken === 'string' &&
    EXPO_TOKEN_PATTERN.test(value.expoPushToken) &&
    (value.platform === 'android' || value.platform === 'ios')
  );
}

function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Falta configurar ${name}.`);
  }
  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
