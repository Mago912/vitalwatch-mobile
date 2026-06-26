import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, Text, Pressable, useColorScheme, View } from 'react-native';

const metrics = [
  {
    label: 'Ritmo cardiaco',
    value: '76',
    unit: 'lpm',
    status: 'Normal',
    accent: '#0E9F6E',
  },
  {
    label: 'Oxigeno',
    value: '98',
    unit: '%',
    status: 'Optimo',
    accent: '#0A7EA4',
  },
  {
    label: 'Temperatura',
    value: '36.7',
    unit: 'C',
    status: 'Estable',
    accent: '#D97706',
  },
  {
    label: 'Presion',
    value: '118/76',
    unit: 'mmHg',
    status: 'Controlada',
    accent: '#7C3AED',
  },
];

const alerts = [
  'Sin alertas criticas en las ultimas 24 horas.',
  'Proxima lectura automatica en 12 minutos.',
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = isDark ? darkPalette : lightPalette;

  const handleEmergencyPress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: palette.muted }]}>VitalWatch</Text>
          <Text style={[styles.title, { color: palette.text }]}>Monitoreo en vivo</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Ultima sincronizacion: hoy, 09:42
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: palette.successSoft }]}>
          <View style={[styles.statusDot, { backgroundColor: palette.success }]} />
          <Text style={[styles.statusText, { color: palette.success }]}>Estable</Text>
        </View>
      </View>

      <View style={[styles.heroCard, { backgroundColor: palette.primary }]}>
        <Text style={styles.heroLabel}>Estado general</Text>
        <Text style={styles.heroTitle}>Todo se ve bien</Text>
        <Text style={styles.heroCopy}>
          Los signos vitales estan dentro del rango esperado. Mantener seguimiento continuo.
        </Text>
        <View style={styles.heroFooter}>
          <View>
            <Text style={styles.heroMetric}>4/4</Text>
            <Text style={styles.heroMetricLabel}>metricas normales</Text>
          </View>
          <View style={styles.signalPills}>
            <View style={styles.signalPill} />
            <View style={styles.signalPill} />
            <View style={styles.signalPillDim} />
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        {metrics.map((metric) => (
          <View
            key={metric.label}
            style={[
              styles.metricCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                boxShadow: palette.cardShadow,
              },
            ]}>
            <View style={[styles.metricAccent, { backgroundColor: metric.accent }]} />
            <Text style={[styles.metricLabel, { color: palette.muted }]}>{metric.label}</Text>
            <View style={styles.metricValueRow}>
              <Text style={[styles.metricValue, { color: palette.text }]}>{metric.value}</Text>
              <Text style={[styles.metricUnit, { color: palette.muted }]}>{metric.unit}</Text>
            </View>
            <Text style={[styles.metricStatus, { color: metric.accent }]}>{metric.status}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Alertas recientes</Text>
          <Text style={[styles.sectionAction, { color: palette.primary }]}>Ver todo</Text>
        </View>
        {alerts.map((alert) => (
          <View key={alert} style={[styles.alertRow, { borderColor: palette.border }]}>
            <View style={[styles.alertDot, { backgroundColor: palette.success }]} />
            <Text style={[styles.alertText, { color: palette.text }]}>{alert}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={handleEmergencyPress}
        style={({ pressed }) => [
          styles.emergencyButton,
          { backgroundColor: pressed ? '#B91C1C' : '#DC2626' },
        ]}>
        <Text style={styles.emergencyText}>Enviar alerta de emergencia</Text>
      </Pressable>
    </ScrollView>
  );
}

const lightPalette = {
  background: '#F6FAFB',
  card: '#FFFFFF',
  text: '#102027',
  muted: '#64748B',
  border: '#E2E8F0',
  primary: '#0A7EA4',
  success: '#0E9F6E',
  successSoft: '#DCFCE7',
  cardShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
};

const darkPalette = {
  background: '#0B1417',
  card: '#132226',
  text: '#F8FAFC',
  muted: '#A7B6C2',
  border: '#24383E',
  primary: '#0F9CC4',
  success: '#34D399',
  successSoft: '#063D2D',
  cardShadow: '0 10px 24px rgba(0, 0, 0, 0.25)',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 116,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    gap: 10,
    borderCurve: 'continuous',
  },
  heroLabel: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 14,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  heroCopy: {
    color: 'rgba(255, 255, 255, 0.84)',
    fontSize: 15,
    lineHeight: 22,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  heroMetric: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  heroMetricLabel: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
  },
  signalPills: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  signalPill: {
    width: 9,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  signalPillDim: {
    width: 9,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 8,
    borderCurve: 'continuous',
  },
  metricAccent: {
    width: 34,
    height: 5,
    borderRadius: 999,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 13,
    fontWeight: '700',
    paddingBottom: 3,
  },
  metricStatus: {
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderCurve: 'continuous',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '800',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10,
  },
  alertDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  alertText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  emergencyButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderCurve: 'continuous',
  },
  emergencyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
