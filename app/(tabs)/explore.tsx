import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

const readings = [
  {
    time: '09:42',
    title: 'Chequeo automatico',
    detail: 'Ritmo 76 lpm, oxigeno 98%, temperatura 36.7 C.',
    level: 'Normal',
    color: '#0E9F6E',
  },
  {
    time: '08:15',
    title: 'Movimiento detectado',
    detail: 'Actividad leve durante 7 minutos. Sin cambios de riesgo.',
    level: 'Info',
    color: '#0A7EA4',
  },
  {
    time: '07:30',
    title: 'Presion registrada',
    detail: 'Lectura 118/76 mmHg, dentro del rango esperado.',
    level: 'Normal',
    color: '#7C3AED',
  },
  {
    time: 'Ayer',
    title: 'Oxigeno bajo en reposo',
    detail: 'Descendio a 93% por 2 minutos y luego se recupero.',
    level: 'Atencion',
    color: '#D97706',
  },
];

const weeklySummary = [
  { label: 'Lecturas', value: '128' },
  { label: 'Alertas', value: '1' },
  { label: 'Promedio FC', value: '74' },
];

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = isDark ? darkPalette : lightPalette;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.muted }]}>Seguimiento</Text>
        <Text style={[styles.title, { color: palette.text }]}>Historial</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Resumen de lecturas recientes y eventos importantes.
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Ultimos 7 dias</Text>
            <Text style={[styles.sectionHint, { color: palette.muted }]}>Datos simulados del MVP</Text>
          </View>
          <View style={[styles.healthBadge, { backgroundColor: palette.successSoft }]}>
            <Text style={[styles.healthBadgeText, { color: palette.success }]}>Bueno</Text>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          {weeklySummary.map((item) => (
            <View key={item.label} style={[styles.summaryItem, { backgroundColor: palette.softCard }]}>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{item.value}</Text>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.timelineHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Eventos recientes</Text>
        <Text style={[styles.sectionHint, { color: palette.muted }]}>Hoy</Text>
      </View>

      <View style={[styles.timeline, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {readings.map((item, index) => (
          <View key={`${item.time}-${item.title}`} style={styles.timelineRow}>
            <View style={styles.timelineMarkerColumn}>
              <View style={[styles.timelineDot, { backgroundColor: item.color }]} />
              {index < readings.length - 1 ? (
                <View style={[styles.timelineLine, { backgroundColor: palette.border }]} />
              ) : null}
            </View>
            <View style={[styles.timelineBody, { borderColor: palette.border }]}>
              <View style={styles.timelineTitleRow}>
                <Text style={[styles.eventTime, { color: palette.muted }]}>{item.time}</Text>
                <Text style={[styles.eventLevel, { color: item.color }]}>{item.level}</Text>
              </View>
              <Text style={[styles.eventTitle, { color: palette.text }]}>{item.title}</Text>
              <Text style={[styles.eventDetail, { color: palette.muted }]}>{item.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.deviceCard, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }]}>
        <Text style={[styles.deviceTitle, { color: palette.primaryText }]}>Dispositivo conectado</Text>
        <Text style={[styles.deviceCopy, { color: palette.primaryText }]}>
          Bateria estimada 82%. La app puede sincronizar lecturas automaticamente cuando conectemos
          la fuente real de datos.
        </Text>
      </View>
    </ScrollView>
  );
}

const lightPalette = {
  background: '#F6FAFB',
  card: '#FFFFFF',
  softCard: '#F1F5F9',
  text: '#102027',
  muted: '#64748B',
  border: '#E2E8F0',
  success: '#0E9F6E',
  successSoft: '#DCFCE7',
  primarySoft: '#E0F2FE',
  primaryBorder: '#BAE6FD',
  primaryText: '#075985',
};

const darkPalette = {
  background: '#0B1417',
  card: '#132226',
  softCard: '#1B2E34',
  text: '#F8FAFC',
  muted: '#A7B6C2',
  border: '#24383E',
  success: '#34D399',
  successSoft: '#063D2D',
  primarySoft: '#082F49',
  primaryBorder: '#0C4A6E',
  primaryText: '#BAE6FD',
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
    gap: 4,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
    borderCurve: 'continuous',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  healthBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  healthBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    gap: 4,
    borderCurve: 'continuous',
  },
  summaryValue: {
    fontSize: 23,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  timeline: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 2,
    borderCurve: 'continuous',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineMarkerColumn: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
    marginTop: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 6,
  },
  timelineBody: {
    flex: 1,
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
    gap: 5,
  },
  timelineTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: '800',
  },
  eventLevel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  eventDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  deviceCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 8,
    borderCurve: 'continuous',
  },
  deviceTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  deviceCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
});
