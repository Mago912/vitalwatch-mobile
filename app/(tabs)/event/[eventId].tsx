import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appColors } from '@/constants/vitalwatch';
import { DeviceEventDetail, fetchDeviceEventDetail } from '@/lib/vitalwatch-api';

const eventTitles: Record<string, string> = {
  call_request: 'LLAMADA',
  fall_detected: 'CAÍDA',
  message_request: 'MENSAJE',
  sos: 'SOS',
};

export default function EventDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const rawEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const eventId = Number(rawEventId);
  const [event, setEvent] = useState<DeviceEventDetail | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchDeviceEventDetail(eventId)
      .then((result) => {
        if (isMounted) setEvent(result);
      })
      .catch((reason) => {
        if (isMounted) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  async function openPhoneFlow(kind: 'call' | 'message') {
    const phone = event?.contact?.phoneNumber?.replace(/[^+\d]/g, '');
    if (!phone || !event?.contact?.active) {
      Alert.alert(
        'Contacto no disponible',
        'El contacto fue eliminado, desactivado o no tiene un telefono autorizado.'
      );
      return;
    }

    const url = `${kind === 'call' ? 'tel' : 'sms'}:${phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('La plataforma no ofrece una aplicacion compatible.');
      await Linking.openURL(url);
    } catch (reason) {
      Alert.alert(
        kind === 'call' ? 'No se pudo abrir el marcador' : 'No se pudo abrir Mensajes',
        reason instanceof Error ? reason.message : String(reason)
      );
    }
  }

  const isFall = event?.type === 'fall_detected';
  const title = event ? eventTitles[event.type] ?? event.type.toUpperCase() : 'EVENTO';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Volver al historial</Text>
      </Pressable>

      {isLoading ? (
        <View style={styles.centerCard}>
          <ActivityIndicator color={appColors.primary} size="large" />
          <Text style={styles.muted}>Consultando el evento dentro de tu sesion...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>No se pudo abrir el evento</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : event ? (
        <>
          <View style={[styles.eventCard, isFall && styles.fallCard]}>
            <Text style={[styles.eventTitle, isFall && styles.fallTitle]}>{title}</Text>
            <Text style={styles.dateText}>
              {new Date(event.eventTime).toLocaleString('es-AR', {
                dateStyle: 'short',
                timeStyle: 'medium',
              })}
            </Text>
            <Text style={styles.messageText}>{event.message}</Text>
            {event.contact ? (
              <View style={styles.contactBox}>
                <Text style={styles.contactLabel}>Contacto autorizado</Text>
                <Text style={styles.contactName}>{event.contact.name}</Text>
                <Text style={styles.contactStatus}>
                  {event.contact.active ? 'Activo' : 'Actualmente inactivo'}
                </Text>
              </View>
            ) : event.contactId ? (
              <Text style={styles.muted}>El contacto asociado ya no esta disponible.</Text>
            ) : null}
          </View>

          {event.type === 'call_request' ? (
            <View style={styles.actionCard}>
              <Text style={styles.actionHelp}>
                VitalWatch abrira el marcador del sistema. La llamada solo comienza si la persona
                confirma la accion permitida por Android o iOS.
              </Text>
              <Pressable onPress={() => void openPhoneFlow('call')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Abrir marcador</Text>
              </Pressable>
            </View>
          ) : null}

          {event.type === 'message_request' ? (
            <View style={styles.actionCard}>
              <Text style={styles.actionHelp}>
                Se abrira el compositor de mensajes del sistema. Nada se envia automaticamente.
              </Text>
              <Pressable onPress={() => void openPhoneFlow('message')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Abrir mensaje</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: appColors.background, flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 80 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backText: { color: appColors.primary, fontSize: 16, fontWeight: '800' },
  centerCard: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  muted: { color: appColors.muted, fontSize: 14, lineHeight: 21 },
  eventCard: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  fallCard: { borderColor: '#FCA5A5', borderWidth: 2 },
  eventTitle: { color: appColors.text, fontSize: 30, fontWeight: '900' },
  fallTitle: { color: appColors.danger },
  dateText: { color: appColors.muted, fontSize: 14, fontWeight: '700' },
  messageText: { color: appColors.text, fontSize: 17, lineHeight: 25 },
  contactBox: { backgroundColor: '#F0F9FF', borderRadius: 14, gap: 3, padding: 14 },
  contactLabel: { color: '#075985', fontSize: 12, fontWeight: '900' },
  contactName: { color: appColors.text, fontSize: 20, fontWeight: '900' },
  contactStatus: { color: appColors.muted, fontSize: 13 },
  actionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, gap: 14, padding: 18 },
  actionHelp: { color: appColors.muted, fontSize: 15, lineHeight: 22 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: appColors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52,
    padding: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  errorCard: { backgroundColor: '#FEF2F2', borderRadius: 20, gap: 8, padding: 18 },
  errorTitle: { color: '#991B1B', fontSize: 20, fontWeight: '900' },
  errorText: { color: '#991B1B', fontSize: 15, lineHeight: 22 },
});
