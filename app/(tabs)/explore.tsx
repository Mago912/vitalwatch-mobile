import { Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appColors } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

export default function HistoryScreen() {
  const { history } = useVitalWatch();
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.appName}>VitalWatch</Text>
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.subtitle}>Eventos almacenados por la pulsera y la app.</Text>
      </View>

      <View style={styles.section}>
        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Todavia no hay eventos registrados.</Text>
            <Text style={styles.eventDescription}>
              Las alertas y acciones reales de la pulsera apareceran aqui.
            </Text>
          </View>
        ) : null}
        {history.map((event) => {
          const isFall = event.eventType === 'fall_detected';
          const title = isFall ? 'CAÍDA' : event.type;
          return (
          <Pressable
            accessibilityHint={event.remoteId ? 'Abre el detalle protegido del evento' : undefined}
            disabled={!event.remoteId}
            key={event.id}
            onPress={() =>
              event.remoteId && router.push(`/event/${event.remoteId}` as Href)
            }
            style={({ pressed }) => [
              styles.eventCard,
              isFall && styles.fallCard,
              pressed && styles.eventCardPressed,
            ]}>
            <View style={styles.eventHeader}>
              <Text style={[styles.eventType, isFall && styles.fallType]}>{title}</Text>
              <Text style={styles.eventDate}>{event.date}</Text>
            </View>
            <Text style={styles.eventDescription}>{event.description}</Text>
            {event.contactName ? (
              <Text style={styles.contactName}>Contacto: {event.contactName}</Text>
            ) : null}
            {event.remoteId ? <Text style={styles.openHint}>Toca para ver el evento</Text> : null}
          </Pressable>
        );})}
      </View>
    </ScrollView>
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
    gap: 12,
  },
  emptyCard: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  emptyTitle: {
    color: appColors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  eventCard: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    borderCurve: 'continuous',
  },
  eventCardPressed: { opacity: 0.72 },
  fallCard: { borderColor: '#FCA5A5', borderWidth: 2 },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventType: {
    flex: 1,
    color: appColors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  fallType: { color: appColors.danger },
  eventDate: {
    color: appColors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  eventDescription: {
    color: appColors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  contactName: { color: appColors.text, fontSize: 15, fontWeight: '800' },
  openHint: { color: appColors.primary, fontSize: 13, fontWeight: '800' },
});
