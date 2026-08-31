import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type PairPayload = {
  deviceCode: string;
  pairingCode: string;
};

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
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
      authorization.slice('Bearer '.length)
    );

    if (authError || !authData.user) {
      return jsonResponse({ error: 'Sesion invalida.' }, 401);
    }

    const payload: unknown = await request.json();
    if (!isPairPayload(payload)) {
      return jsonResponse({ error: 'Codigos de vinculacion invalidos.' }, 400);
    }

    const { data, error } = await supabaseAdmin.rpc('pair_vitalwatch_device_admin', {
      requested_auth_user: authData.user.id,
      requested_device_code: payload.deviceCode.trim().toUpperCase(),
      requested_pairing_hash: await sha256(payload.pairingCode.trim().toUpperCase()),
    });

    if (error) {
      throw error;
    }

    if (!data) {
      return jsonResponse({ error: 'Codigo de pulsera o vinculacion incorrecto.' }, 403);
    }

    return jsonResponse({ paired: true });
  } catch (error) {
    console.error('pair-vitalwatch-device:', getErrorMessage(error));
    return jsonResponse({ error: 'No se pudo vincular la pulsera.' }, 500);
  }
});

function isPairPayload(payload: unknown): payload is PairPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<PairPayload>;
  return (
    typeof value.deviceCode === 'string' &&
    value.deviceCode.trim().length > 0 &&
    value.deviceCode.length <= 100 &&
    typeof value.pairingCode === 'string' &&
    value.pairingCode.trim().length >= 12 &&
    value.pairingCode.length <= 100
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') return JSON.stringify(error);
  return String(error);
}
