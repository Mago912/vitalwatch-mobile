import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { appColors, EmergencyContact } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

export default function ContactsScreen() {
  const router = useRouter();
  const {
    addPhoneContact,
    deleteEmergencyContact,
    emergencyContacts,
    emergencyContactSyncMessage,
    isContactSyncing,
    refreshEmergencyContacts,
    setEmergencyContactActive,
    updatePhoneContact,
  } = useVitalWatch();
  const [editing, setEditing] = useState<EmergencyContact | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formError, setFormError] = useState('');
  const phoneContacts = emergencyContacts.filter((contact) => contact.channel === 'sms');

  useEffect(() => {
    void refreshEmergencyContacts(false);
    // La suscripcion Realtime del provider mantiene la pantalla al dia luego
    // de esta carga inicial; repetir por cada render provocaria sondeo extra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearForm() {
    setEditing(null);
    setName('');
    setPhoneNumber('');
    setFormError('');
  }

  function startEditing(contact: EmergencyContact) {
    setEditing(contact);
    setName(contact.name);
    setPhoneNumber(contact.phoneNumber ?? '');
    setFormError('');
  }

  async function saveContact() {
    setFormError('');
    try {
      const input = { active: editing?.active ?? true, name, phoneNumber };
      const saved = editing
        ? await updatePhoneContact(editing.id, input)
        : await addPhoneContact(input);
      if (saved) clearForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }

  function confirmDelete(contact: EmergencyContact) {
    Alert.alert(
      'Eliminar contacto',
      `Se eliminara a ${contact.name} de VitalWatch y dejara de aparecer en la pulsera.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void deleteEmergencyContact(contact.id),
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Volver</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.appName}>VitalWatch</Text>
          <Text style={styles.title}>Contactos</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Privacidad de la pulsera</Text>
        <Text style={styles.infoText}>
          El ESP32 sincroniza solamente el ID y el nombre visible. El telefono queda protegido en
          Supabase y se consulta dentro de la app al abrir una solicitud.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{editing ? 'Editar contacto' : 'Agregar contacto'}</Text>
        <TextInput
          accessibilityLabel="Nombre visible"
          maxLength={80}
          onChangeText={setName}
          placeholder="Nombre visible, por ejemplo Maria"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          value={name}
        />
        <TextInput
          accessibilityLabel="Numero telefonico"
          keyboardType="phone-pad"
          maxLength={24}
          onChangeText={setPhoneNumber}
          placeholder="+54 9 11 5555 1234"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          value={phoneNumber}
        />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <View style={styles.formActions}>
          {editing ? (
            <Pressable onPress={clearForm} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={isContactSyncing}
            onPress={() => void saveContact()}
            style={[styles.primaryButton, isContactSyncing && styles.disabled]}>
            {isContactSyncing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{editing ? 'Guardar' : 'Agregar'}</Text>
            )}
          </Pressable>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.syncText}>
          {emergencyContactSyncMessage}
        </Text>
      </View>

      <View style={styles.list}>
        {phoneContacts.map((contact) => (
          <View key={contact.id} style={[styles.contactCard, !contact.active && styles.inactiveCard]}>
            <View style={styles.contactTopRow}>
              <View style={styles.contactText}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
                <Text style={styles.contactMeta}>
                  ID {contact.id} · {contact.active ? 'ACTIVO' : 'INACTIVO'}
                </Text>
              </View>
              <Switch
                accessibilityLabel={`${contact.active ? 'Desactivar' : 'Activar'} a ${contact.name}`}
                disabled={isContactSyncing}
                onValueChange={(active) => void setEmergencyContactActive(contact.id, active)}
                trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
                thumbColor={contact.active ? appColors.primary : '#64748B'}
                value={contact.active}
              />
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={() => startEditing(contact)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(contact)} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {phoneContacts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Todavia no hay contactos telefonicos.</Text>
            <Text style={styles.infoText}>Agrega uno para que aparezca en Mensajeria.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: appColors.background, flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 80 },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  headerText: { flex: 1 },
  backButton: { minHeight: 44, justifyContent: 'center' },
  backText: { color: appColors.primary, fontSize: 16, fontWeight: '800' },
  appName: { color: appColors.primary, fontSize: 15, fontWeight: '800' },
  title: { color: appColors.text, fontSize: 32, fontWeight: '900' },
  infoCard: { backgroundColor: '#E0F2FE', borderRadius: 20, gap: 6, padding: 16 },
  infoTitle: { color: '#075985', fontSize: 17, fontWeight: '900' },
  infoText: { color: '#075985', fontSize: 14, lineHeight: 21 },
  section: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionTitle: { color: appColors.text, fontSize: 20, fontWeight: '900' },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: appColors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 13,
  },
  formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: appColors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 116,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: appColors.primary,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: appColors.primary, fontWeight: '900' },
  deleteButton: {
    alignItems: 'center',
    borderColor: appColors.danger,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  deleteButtonText: { color: appColors.danger, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  errorText: { color: appColors.danger, fontSize: 14, fontWeight: '700' },
  syncText: { color: appColors.muted, fontSize: 13, lineHeight: 19 },
  list: { gap: 12 },
  contactCard: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  inactiveCard: { opacity: 0.68 },
  contactTopRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  contactText: { flex: 1 },
  contactName: { color: appColors.text, fontSize: 18, fontWeight: '900' },
  contactPhone: { color: appColors.muted, fontSize: 15, marginTop: 3 },
  contactMeta: { color: appColors.primary, fontSize: 12, fontWeight: '900', marginTop: 6 },
  cardActions: { flexDirection: 'row', gap: 10 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 20, gap: 6, padding: 18 },
  emptyTitle: { color: appColors.text, fontSize: 16, fontWeight: '900' },
});
