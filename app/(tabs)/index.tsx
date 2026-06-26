import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appColors, statusStyles } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

export default function HomeScreen() {
  const {
    activateFall,
    activateLowBattery,
    activateMedicationReminder,
    activateNormal,
    activateSos,
    battery,
    history,
    lastUpdated,
    notificationPermission,
    profile,
    status,
    vitals,
  } = useVitalWatch();

  const currentStatus = statusStyles[status];
  const trendLabel =
    vitals.trend === 'sube' ? 'Subiendo' : vitals.trend === 'baja' ? 'Bajando' : 'Estable';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.appName}>VitalWatch</Text>
        <Text style={styles.title}>Panel principal</Text>
        <Text style={styles.subtitle}>Adulto mayor: {profile.elderName}</Text>
      </View>

      <View style={[styles.statusCard, { backgroundColor: currentStatus.softColor }]}>
        <Text style={[styles.statusLabel, { color: currentStatus.text }]}>Estado actual</Text>
        <Text style={[styles.statusTitle, { color: currentStatus.color }]}>{status}</Text>
        <Text style={[styles.statusDescription, { color: currentStatus.text }]}>
          {currentStatus.description}
        </Text>
      </View>

      <View style={styles.liveHeader}>
        <View>
          <Text style={styles.sectionTitle}>Signos vitales en vivo</Text>
          <Text style={styles.sectionHelp}>Lecturas simuladas actualizadas automaticamente.</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>En vivo</Text>
        </View>
      </View>

      <View style={styles.vitalsGrid}>
        <VitalCard
          color="#DC2626"
          label="Ritmo cardiaco"
          max={130}
          min={50}
          normalText="Normal: 60 a 100 lpm"
          unit="lpm"
          value={vitals.heartRate}
        />
        <VitalCard
          color="#0A7EA4"
          label="Oxigeno"
          max={100}
          min={85}
          normalText="Normal: 95% o mas"
          unit="%"
          value={vitals.oxygen}
        />
        <VitalCard
          color="#D97706"
          decimals={1}
          label="Temperatura"
          max={39}
          min={35}
          normalText="Normal: 36.0 a 37.5 C"
          unit="C"
          value={vitals.temperature}
        />
        <VitalCard
          color="#6D28D9"
          label="Presion"
          max={160}
          min={90}
          normalText="Referencia: aprox. 120/80"
          unit="mmHg"
          value={vitals.systolicPressure}
          valueText={`${vitals.systolicPressure}/${vitals.diastolicPressure}`}
        />
      </View>

      <View style={styles.movementCard}>
        <View>
          <Text style={styles.infoLabel}>Movimiento detectado</Text>
          <Text style={styles.movementValue}>{vitals.movement}</Text>
        </View>
        <View style={styles.trendBox}>
          <Text style={styles.trendLabel}>Pulso</Text>
          <Text style={styles.trendValue}>{trendLabel}</Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Bateria pulsera</Text>
          <Text style={styles.infoValue}>{battery}%</Text>
          <View style={styles.batteryTrack}>
            <View
              style={[
                styles.batteryFill,
                {
                  width: `${battery}%`,
                  backgroundColor: battery <= 20 ? appColors.danger : currentStatus.color,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Ultima actualizacion</Text>
          <Text style={styles.infoValueSmall}>{lastUpdated}</Text>
          <Text style={styles.permissionText}>
            Notificaciones: {notificationPermission ? 'activas' : 'sin permiso'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Simular eventos</Text>
        <Text style={styles.sectionHelp}>
          Estos botones imitan lo que mas adelante enviara la pulsera con ESP32.
        </Text>

        <View style={styles.buttonGrid}>
          <ActionButton color="#0E9F6E" label="Estado normal" onPress={activateNormal} />
          <ActionButton color="#EA580C" label="Simular caida" onPress={activateFall} />
          <ActionButton color="#DC2626" label="Activar SOS" onPress={activateSos} />
          <ActionButton color="#F59E0B" label="Bateria baja" onPress={activateLowBattery} />
          <ActionButton
            color="#6D28D9"
            label="Medicacion pendiente"
            onPress={activateMedicationReminder}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ultimos eventos</Text>
        {history.slice(0, 3).map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <View style={styles.eventDot} />
            <View style={styles.eventTextBox}>
              <Text style={styles.eventType}>{event.type}</Text>
              <Text style={styles.eventDescription}>{event.description}</Text>
              <Text style={styles.eventDate}>{event.date}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function VitalCard({
  color,
  decimals = 0,
  label,
  max,
  min,
  normalText,
  unit,
  value,
  valueText,
}: {
  color: string;
  decimals?: number;
  label: string;
  max: number;
  min: number;
  normalText: string;
  unit: string;
  value: number;
  valueText?: string;
}) {
  const progress = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const visibleValue = valueText ?? value.toFixed(decimals);

  return (
    <View style={styles.vitalCard}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <View style={styles.vitalValueRow}>
        <Text style={styles.vitalValue}>{visibleValue}</Text>
        <Text style={styles.vitalUnit}>{unit}</Text>
      </View>
      <View style={styles.vitalTrack}>
        <View style={[styles.vitalFill, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.vitalNormal}>{normalText}</Text>
    </View>
  );
}

function ActionButton({
  color,
  label,
  onPress,
}: {
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: pressed ? '#334155' : color,
        },
      ]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
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
  statusCard: {
    borderRadius: 26,
    padding: 22,
    gap: 8,
    borderCurve: 'continuous',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusTitle: {
    fontSize: 34,
    fontWeight: '900',
  },
  statusDescription: {
    fontSize: 17,
    lineHeight: 24,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    borderCurve: 'continuous',
  },
  infoLabel: {
    color: appColors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  infoValue: {
    color: appColors.text,
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  infoValueSmall: {
    color: appColors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  batteryTrack: {
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  batteryFill: {
    height: '100%',
    borderRadius: 999,
  },
  permissionText: {
    color: appColors.muted,
    fontSize: 13,
  },
  section: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
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
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#0E9F6E',
  },
  liveText: {
    color: '#064E3B',
    fontSize: 13,
    fontWeight: '900',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vitalCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    borderCurve: 'continuous',
  },
  vitalLabel: {
    color: appColors.muted,
    fontSize: 14,
    fontWeight: '900',
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  vitalValue: {
    color: appColors.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  vitalUnit: {
    color: appColors.muted,
    fontSize: 13,
    fontWeight: '900',
    paddingBottom: 4,
  },
  vitalTrack: {
    height: 9,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  vitalFill: {
    height: '100%',
    borderRadius: 999,
  },
  vitalNormal: {
    color: appColors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  movementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    borderCurve: 'continuous',
  },
  movementValue: {
    color: appColors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  trendBox: {
    alignItems: 'flex-end',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderCurve: 'continuous',
  },
  trendLabel: {
    color: appColors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  trendValue: {
    color: appColors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  buttonGrid: {
    gap: 10,
  },
  actionButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderCurve: 'continuous',
  },
  actionButtonText: {
    color: appColors.buttonText,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    borderTopColor: appColors.border,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  eventDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: appColors.primary,
    marginTop: 6,
  },
  eventTextBox: {
    flex: 1,
    gap: 2,
  },
  eventType: {
    color: appColors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  eventDescription: {
    color: appColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  eventDate: {
    color: appColors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
});
