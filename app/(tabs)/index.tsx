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
  } = useVitalWatch();

  const currentStatus = statusStyles[status];

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
