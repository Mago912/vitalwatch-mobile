import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { appColors } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

export default function HistoryScreen() {
  const { history } = useVitalWatch();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.appName}>VitalWatch</Text>
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.subtitle}>Eventos simulados de la pulsera y la app.</Text>
      </View>

      <View style={styles.section}>
        {history.map((event) => (
          <View key={event.id} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventType}>{event.type}</Text>
              <Text style={styles.eventDate}>{event.date}</Text>
            </View>
            <Text style={styles.eventDescription}>{event.description}</Text>
          </View>
        ))}
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
  eventCard: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    borderCurve: 'continuous',
  },
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
});
