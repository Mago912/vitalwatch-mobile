import { supabaseKey, supabaseUrl } from '@/lib/supabase';

export type TelegramLink = {
  botUsername: string;
  code: string;
  expiresAt: string;
};

export async function createTelegramLink(accessToken: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/create-telegram-link`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => null);

  if (!response) throw new Error('No se pudo conectar con Supabase.');
  const result = (await response.json().catch(() => ({}))) as Partial<TelegramLink> & {
    error?: string;
  };
  if (!response.ok || !result.code || !result.botUsername || !result.expiresAt) {
    throw new Error(result.error ?? `Error HTTP ${response.status}.`);
  }

  return result as TelegramLink;
}
