import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

import {
  formatLinkedDeviceStatus,
  LinkedDeviceStatus,
  parseTelegramLinkCode,
} from '../_shared/telegram-link.ts';

type TelegramUpdate = {
  message?: {
    chat?: { id?: number; type?: string };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('ok');

  const expectedSecret = requireEnvironment('TELEGRAM_WEBHOOK_SECRET');
  if (request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
    return jsonResponse({ error: 'Webhook no autorizado.' }, 401);
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim() ?? '';
    if (!chatId || update.message?.chat?.type !== 'private') return new Response('ok');

    // El enlace directo de Telegram envia /start CODIGO. Conservamos el
    // comando /vincular CODIGO como alternativa manual.
    const linkCode = parseTelegramLinkCode(text);
    if (!linkCode) {
      await sendTelegramMessage(
        chatId,
        'Para vincular VitalWatch, genera un codigo en la app y envia: /vincular CODIGO'
      );
      return new Response('ok');
    }

    const supabaseAdmin = createClient(
      requireEnvironment('SUPABASE_URL'),
      requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const code = linkCode;
    const { data: link, error: linkError } = await supabaseAdmin
      .from('telegram_link_codes')
      .select('user_id, expires_at')
      .eq('code', code)
      .maybeSingle();
    if (linkError) throw linkError;

    if (!link || new Date(link.expires_at).getTime() <= Date.now()) {
      await sendTelegramMessage(chatId, 'El codigo vencio o no es valido. Genera uno nuevo en la app.');
      return new Response('ok');
    }

    const firstName = update.message?.from?.first_name?.trim();
    const username = update.message?.from?.username?.trim();
    const contactName = firstName || (username ? `@${username}` : 'Contacto Telegram');
    const { error: contactError } = await supabaseAdmin.from('emergency_contacts').upsert(
      {
        user_id: link.user_id,
        name: contactName,
        phone_e164: null,
        channel: 'telegram',
        telegram_chat_id: chatId,
        telegram_username: username ?? null,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,telegram_chat_id' }
    );
    if (contactError) throw contactError;

    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .select('connection_status, last_seen_at')
      .eq('user_id', link.user_id)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (deviceError) throw deviceError;

    await supabaseAdmin.from('telegram_link_codes').delete().eq('code', code);
    await sendTelegramMessage(
      chatId,
      [
        'VitalWatch quedo vinculado. Este chat recibira las alertas automaticas.',
        formatLinkedDeviceStatus(device as LinkedDeviceStatus | null),
      ]
        .filter(Boolean)
        .join('\n\n')
    );
    return new Response('ok');
  } catch (error) {
    console.error('telegram-vitalwatch-bot:', getErrorMessage(error));
    return new Response('ok');
  }
});

async function sendTelegramMessage(chatId: number, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${requireEnvironment('TELEGRAM_BOT_TOKEN')}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
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
