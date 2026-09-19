import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { appColors } from '@/constants/vitalwatch';
import { useAuth } from '@/providers/auth-provider';
import { useVitalWatch } from '@/providers/vitalwatch-provider';
import { createTelegramLink, TelegramLink } from '@/lib/vitalwatch-telegram';

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const {
    deleteEmergencyContact,
    emergencyContacts,
    emergencyContactSyncMessage,
    notificationPermission,
    profile,
    pushNotificationMessage,
    pushNotificationStatus,
    retryPushNotifications,
    updateProfile,
  } = useVitalWatch();
  const [elderName, setElderName] = useState(profile.elderName);
  const [contactError, setContactError] = useState('');
  const [isCreatingTelegramLink, setIsCreatingTelegramLink] = useState(false);
  const [telegramLink, setTelegramLink] = useState<TelegramLink | null>(null);
  const [telegramStatusMessage, setTelegramStatusMessage] = useState('');
  const telegramContactsAtStart = useRef<Set<string>>(new Set());
  const isRegisteringPushNotifications = pushNotificationStatus === 'Registrando';
  const appVersion = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? 'desarrollo';
  const buildVersion = Constants.nativeBuildVersion ?? 'sin numero';
  const telegramContacts = useMemo(
    () => emergencyContacts.filter((contact) => contact.channel === 'telegram'),
    [emergencyContacts]
  );

  useEffect(() => {
    setElderName(profile.elderName);
  }, [profile]);

  useEffect(() => {
    if (!telegramLink) return;

    const linkedContact = telegramContacts.find(
      (contact) => !telegramContactsAtStart.current.has(contact.id)
    );
    if (!linkedContact) return;

    setTelegramLink(null);
    setTelegramStatusMessage(`${linkedContact.name} quedo vinculado para recibir alertas.`);
  }, [telegramContacts, telegramLink]);

  function handleSave() {
    updateProfile({
      ...profile,
      elderName,
    });
  }

  async function handleCreateTelegramLink() {
    if (!session) {
      setContactError('Inicia sesion para vincular Telegram.');
      return;
    }

    setIsCreatingTelegramLink(true);
    try {
      const link = await createTelegramLink(session.access_token);
      telegramContactsAtStart.current = new Set(telegramContacts.map((contact) => contact.id));
      setTelegramLink(link);
      setContactError('');
      setTelegramStatusMessage('Codigo listo. Abri Telegram y toca INICIAR.');
    } catch (error) {
      setContactError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingTelegramLink(false);
    }
  }

  async function handleOpenTelegram() {
    if (!telegramLink) return;
    try {
      await Linking.openURL(
        `https://t.me/${telegramLink.botUsername}?start=${encodeURIComponent(telegramLink.code)}`
      );
      setContactError('');
    } catch {
      setContactError('No se pudo abrir Telegram. Usa el comando manual que aparece debajo.');
    }
  }

  function handleDeleteEmergencyContact(id: string) {
    void deleteEmergencyContact(id);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.appName}>VitalWatch</Text>
        <Text style={styles.title}>Configuracion</Text>
        <Text style={styles.subtitle}>Datos del usuario, contactos y alertas.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contactos</Text>
        <Text style={styles.sectionHelp}>
          Administra los nombres y telefonos autorizados que la pulsera puede mostrar. El numero
          permanece dentro de la app y Supabase.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/contacts' as Href)}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}>
          <Text style={styles.outlineButtonText}>Abrir Contactos</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alertas por Telegram</Text>
        <Text style={styles.sectionHelp}>
          Cada familiar vincula su chat una sola vez. Las alertas se envian desde Supabase aunque
          esta aplicacion este cerrada.
        </Text>

        {telegramContacts.map((contact) => (
          <View key={contact.id} style={styles.emergencyContactRow}>
            <View style={styles.emergencyContactText}>
              <Text style={styles.emergencyContactName}>{contact.name}</Text>
              <Text style={styles.emergencyContactPhone}>
                {contact.telegramUsername ? `@${contact.telegramUsername}` : 'Chat privado vinculado'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Eliminar a ${contact.name}`}
              accessibilityRole="button"
              onPress={() => handleDeleteEmergencyContact(contact.id)}
              style={({ pressed }) => [styles.deleteContactButton, pressed && styles.buttonPressed]}>
              <Text style={styles.deleteContactText}>Eliminar</Text>
            </Pressable>
          </View>
        ))}

        {telegramContacts.length === 0 ? (
          <Text style={styles.sectionHelp}>Todavia no hay chats de Telegram vinculados.</Text>
        ) : null}

        <Pressable
          disabled={isCreatingTelegramLink}
          onPress={() => void handleCreateTelegramLink()}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: pressed ? '#075985' : appColors.primary },
            isCreatingTelegramLink && styles.outlineButtonDisabled,
          ]}>
          <Text style={styles.saveButtonText}>
            {isCreatingTelegramLink ? 'Generando...' : 'Vincular un familiar'}
          </Text>
        </Pressable>

        {telegramLink ? (
          <View style={styles.telegramLinkBox}>
            <Text style={styles.inputLabel}>Codigo temporal</Text>
            <Text selectable style={styles.telegramCode}>{telegramLink.code}</Text>
            <Text style={styles.sectionHelp}>
              Abri Telegram y toca INICIAR. El codigo se enviara automaticamente y vence en 10 minutos.
            </Text>
            <Pressable
              onPress={() => void handleOpenTelegram()}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}>
              <Text style={styles.outlineButtonText}>Abrir y vincular en Telegram</Text>
            </Pressable>
            <Text selectable style={styles.manualCommand}>
              Alternativa manual: /vincular {telegramLink.code}
            </Text>
          </View>
        ) : null}
        {telegramStatusMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.successText}>
            {telegramStatusMessage}
          </Text>
        ) : null}
        {contactError ? <Text style={styles.errorText}>{contactError}</Text> : null}
        <Text style={styles.sectionHelp}>{emergencyContactSyncMessage}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos del usuario</Text>
        <InputField
          label="Nombre del adulto mayor"
          value={elderName}
          onChangeText={setElderName}
          placeholder="Ej: Alicia Gomez"
        />
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: pressed ? '#075985' : appColors.primary },
          ]}>
          <Text style={styles.saveButtonText}>Guardar cambios</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificaciones remotas</Text>
        <View style={styles.pushStatusRow}>
          <View
            style={[
              styles.pushStatusDot,
              pushNotificationStatus === 'Activas'
                ? styles.pushStatusDotActive
                : styles.pushStatusDotInactive,
            ]}
          />
          <Text style={styles.pushStatusText}>{pushNotificationStatus}</Text>
        </View>
        <Text style={styles.sectionHelp}>{pushNotificationMessage}</Text>
        <Text style={styles.diagnosticText}>
          Permiso del sistema: {notificationPermission ? 'concedido' : 'no concedido'}
        </Text>
        <Text style={styles.diagnosticText}>
          Version instalada: {appVersion} ({buildVersion})
        </Text>
        <Pressable
          disabled={isRegisteringPushNotifications}
          onPress={() => void retryPushNotifications()}
          style={({ pressed }) => [
            styles.outlineButton,
            isRegisteringPushNotifications && styles.outlineButtonDisabled,
            pressed && !isRegisteringPushNotifications && styles.outlineButtonPressed,
          ]}>
          <Text style={styles.outlineButtonText}>
            {isRegisteringPushNotifications ? 'Registrando...' : 'Reintentar registro'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openSettings()}
          style={({ pressed }) => [
            styles.systemSettingsButton,
            pressed && styles.systemSettingsButtonPressed,
          ]}>
          <Text style={styles.systemSettingsButtonText}>Abrir permisos del sistema</Text>
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Importante</Text>
        <Text style={styles.noteText}>
          Telegram recibe los avisos directamente desde Supabase. Funciona con la app cerrada siempre
          que la pulsera y el servicio de Telegram tengan acceso a Internet.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <Text style={styles.sectionHelp}>{session?.user.email}</Text>
        <Pressable
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}>
          <Text style={styles.signOutButtonText}>Cerrar sesion</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InputField({
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  value,
}: {
  keyboardType?: 'default' | 'phone-pad';
  label: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  appName: {
    color: appColors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: appColors.text,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: appColors.muted,
    fontSize: 17,
    marginTop: 4,
  },
  section: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 16,
    borderCurve: 'continuous',
  },
  sectionTitle: {
    color: appColors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  sectionHelp: {
    color: appColors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  diagnosticText: {
    color: appColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
  successText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '800',
  },
  manualCommand: {
    color: appColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: appColors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: appColors.text,
    fontSize: 17,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  saveButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderCurve: 'continuous',
  },
  saveButtonText: {
    color: appColors.buttonText,
    fontSize: 17,
    fontWeight: '900',
  },
  pushStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  pushStatusDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  pushStatusDotActive: {
    backgroundColor: '#0E9F6E',
  },
  pushStatusDotInactive: {
    backgroundColor: '#F59E0B',
  },
  pushStatusText: {
    color: appColors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: appColors.primary,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 54,
    padding: 12,
  },
  outlineButtonPressed: {
    backgroundColor: '#E0F2FE',
  },
  outlineButtonDisabled: {
    opacity: 0.55,
  },
  outlineButtonText: {
    color: appColors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  systemSettingsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    padding: 10,
  },
  systemSettingsButtonPressed: {
    opacity: 0.65,
  },
  systemSettingsButtonText: {
    color: appColors.muted,
    fontSize: 15,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  noteCard: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    borderCurve: 'continuous',
  },
  noteTitle: {
    color: '#075985',
    fontSize: 18,
    fontWeight: '900',
  },
  noteText: {
    color: '#075985',
    fontSize: 15,
    lineHeight: 22,
  },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#DC2626',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    padding: 12,
  },
  signOutButtonPressed: {
    backgroundColor: '#FEE2E2',
  },
  signOutButtonText: {
    color: '#B91C1C',
    fontSize: 16,
    fontWeight: '900',
  },
  emergencyContactRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  emergencyContactText: { flex: 1 },
  emergencyContactName: { color: appColors.text, fontSize: 16, fontWeight: '900' },
  emergencyContactPhone: { color: appColors.muted, fontSize: 14, marginTop: 2 },
  telegramLinkBox: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  telegramCode: {
    color: appColors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  deleteContactButton: {
    alignItems: 'center',
    borderColor: '#DC2626',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  deleteContactText: { color: '#B91C1C', fontSize: 14, fontWeight: '900' },
  buttonPressed: { opacity: 0.65 },
});
