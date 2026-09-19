import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido.' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Sesion requerida.' }, 401);
    }

    const supabaseAdmin = createClient(
      requireEnvironment('SUPABASE_URL'),
      requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
      authorization.slice('Bearer '.length)
    );

    if (authError || !authData.user) {
      return jsonResponse({ error: 'Sesion invalida.' }, 401);
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return jsonResponse({ error: 'Primero vincula una pulsera.' }, 403);

    const code = createLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: linkError } = await supabaseAdmin.from('telegram_link_codes').upsert(
      { code, user_id: user.id, expires_at: expiresAt },
      { onConflict: 'user_id' }
    );
    if (linkError) throw linkError;

    return jsonResponse({
      botUsername: requireEnvironment('TELEGRAM_BOT_USERNAME').replace(/^@/, ''),
      code,
      expiresAt,
    });
  } catch (error) {
    console.error('create-telegram-link:', getErrorMessage(error));
    return jsonResponse({ error: 'No se pudo crear el codigo de Telegram.' }, 500);
  }
});

function createLinkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = new Uint8Array(8);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
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
  return error instanceof Error ? error.message : String(error);
}
