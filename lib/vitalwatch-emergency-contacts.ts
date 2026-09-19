import { EmergencyContact } from '@/constants/vitalwatch';
import { supabase } from '@/lib/supabase';

type EmergencyContactRow = {
  active: boolean;
  channel: 'sms' | 'telegram';
  id: number;
  name: string;
  phone_e164: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
};

export type PhoneContactInput = {
  active: boolean;
  name: string;
  phoneNumber: string;
};

const CONTACT_COLUMNS =
  'id, name, phone_e164, channel, active, telegram_chat_id, telegram_username';

// VW-APP-01 — La agenda VitalWatch usa la tabla existente y nunca solicita
// acceso a la agenda completa del telefono. RLS mantiene cada fila ligada al
// usuario autenticado; la pulsera recibe otra vista reducida desde Edge.
export async function fetchRemoteEmergencyContacts(userId: number) {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select(CONTACT_COLUMNS)
    .eq('user_id', userId)
    .order('active', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`No se pudieron leer los contactos: ${error.message}`);
  }

  return ((data ?? []) as EmergencyContactRow[]).map(mapEmergencyContact);
}

export async function createRemotePhoneContact(userId: number, input: PhoneContactInput) {
  const { error } = await supabase.from('emergency_contacts').insert({
    active: input.active,
    channel: 'sms',
    name: normalizeContactName(input.name),
    phone_e164: normalizePhoneNumber(input.phoneNumber),
    user_id: userId,
  });

  if (error) throw new Error(`No se pudo agregar el contacto: ${error.message}`);
  return fetchRemoteEmergencyContacts(userId);
}

export async function updateRemotePhoneContact(
  userId: number,
  contactId: string,
  input: PhoneContactInput
) {
  const { error } = await supabase
    .from('emergency_contacts')
    .update({
      active: input.active,
      name: normalizeContactName(input.name),
      phone_e164: normalizePhoneNumber(input.phoneNumber),
      updated_at: new Date().toISOString(),
    })
    .eq('id', toContactId(contactId))
    .eq('user_id', userId)
    .eq('channel', 'sms');

  if (error) throw new Error(`No se pudo editar el contacto: ${error.message}`);
  return fetchRemoteEmergencyContacts(userId);
}

export async function setRemoteContactActive(
  userId: number,
  contactId: string,
  active: boolean
) {
  const { error } = await supabase
    .from('emergency_contacts')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', toContactId(contactId))
    .eq('user_id', userId);

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  return fetchRemoteEmergencyContacts(userId);
}

export async function deleteRemoteEmergencyContact(userId: number, contactId: string) {
  const { error } = await supabase
    .from('emergency_contacts')
    .delete()
    .eq('id', toContactId(contactId))
    .eq('user_id', userId);

  if (error) throw new Error(`No se pudo eliminar el contacto: ${error.message}`);
  return fetchRemoteEmergencyContacts(userId);
}

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();
  const hasInternationalPrefix = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Ingresa un telefono valido de 8 a 15 digitos, preferentemente con +54.');
  }

  return `${hasInternationalPrefix ? '+' : ''}${digits}`;
}

function normalizeContactName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    throw new Error('El nombre debe tener entre 2 y 80 caracteres.');
  }
  return name;
}

function toContactId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('Contacto invalido.');
  return parsed;
}

function mapEmergencyContact(contact: EmergencyContactRow): EmergencyContact {
  return {
    active: contact.active,
    channel: contact.channel,
    id: String(contact.id),
    name: contact.name,
    phoneNumber: contact.phone_e164,
    telegramChatId:
      contact.telegram_chat_id === null ? null : String(contact.telegram_chat_id),
    telegramUsername: contact.telegram_username,
  };
}
