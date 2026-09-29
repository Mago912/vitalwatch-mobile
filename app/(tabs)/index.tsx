import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { VitalWatchLogo } from '@/components/vitalwatch-logo';
import { appColors, statusStyles } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

export default function HomeScreen() {
  const {
    backendReachable,
    battery,
    history,
    isSyncing,
    lastUpdated,
    notificationPermission,
    profile,
    pushNotificationStatus,
    readingStatus,
    refreshRemoteData,
    status,
    syncError,
    vitals,
  } = useVitalWatch();

  const currentStatus = statusStyles[status];
  const readingColor =
    readingStatus === 'Reciente' || readingStatus === 'Simulada'
      ? '#0E9F6E'
      : readingStatus === 'Sin comunicacion' || readingStatus === 'Sin conexion'
        ? '#DC2626'
        : '#F59E0B';
  const readingSoftColor =
    readingStatus === 'Reciente' || readingStatus === 'Simulada'
      ? '#DCFCE7'
      : readingStatus === 'Sin comunicacion' || readingStatus === 'Sin conexion'
        ? '#FEE2E2'
        : '#FEF3C7';
  const readingTextColor =
    readingStatus === 'Reciente' || readingStatus === 'Simulada'
      ? '#064E3B'
      : readingStatus === 'Sin comunicacion' || readingStatus === 'Sin conexion'
        ? '#7F1D1D'
        : '#78350F';
  const trendLabel =
    vitals.trend === 'sin datos'
      ? 'Sin datos'
      : vitals.trend === 'sube'
      ? 'Subiendo'
      : vitals.trend === 'baja'
        ? 'Bajando'
        : 'Estable';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <VitalWatchLogo compact />
        <Text style={styles.title}>Panel principal</Text>
        <Text style={styles.subtitle}>
          Adulto mayor: {profile.elderName || 'Sin configurar'}
        </Text>
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
          <Text style={styles.sectionTitle}>Signos vitales</Text>
          <Text style={styles.sectionHelp}>
            {readingStatus === 'Reciente'
              ? 'Lectura reciente recibida. Uso experimental.'
              : readingStatus === 'Demorada'
                ? 'La ultima lectura es antigua y no se muestra como actual.'
                : readingStatus === 'Sin comunicacion'
                  ? 'La pulsera no esta enviando datos. Revisa su energia y conexion.'
                  : readingStatus === 'Sin conexion'
                    ? 'No se pudo consultar la base de datos.'
                    : 'Todavia no se recibieron lecturas validas.'}
          </Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: readingSoftColor }]}>
          <View style={[styles.liveDot, { backgroundColor: readingColor }]} />
          <Text style={[styles.liveText, { color: readingTextColor }]}>{readingStatus}</Text>
        </View>
      </View>

      <View style={styles.vitalsGrid}>
        <VitalCard
          color="#DC2626"
          label="Ritmo cardiaco"
          max={130}
          min={50}
          normalText="Lectura experimental"
          unit="lpm"
          value={vitals.heartRate}
        />
        <VitalCard
          color="#0A7EA4"
          label="Oxigeno"
          max={100}
          min={85}
          normalText="Lectura experimental"
          unit="%"
          value={vitals.oxygen}
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
          <Text style={styles.infoValue}>{battery === null ? '--' : `${battery}%`}</Text>
          {battery === null ? <Text style={styles.permissionText}>Sin lectura de bateria</Text> : null}
          <View style={styles.batteryTrack}>
            <View
              style={[
                styles.batteryFill,
                {
                  width: `${battery ?? 0}%`,
                  backgroundColor: battery !== null && battery <= 20 ? appColors.danger : currentStatus.color,
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
          <Text style={styles.permissionText}>Push remotas: {pushNotificationStatus}</Text>
          <Text style={styles.permissionText}>
            Base de datos: {backendReachable ? 'disponible' : 'sin conexion'}
          </Text>
          {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
          <Pressable
            disabled={isSyncing}
            onPress={() => void refreshRemoteData()}
            style={({ pressed }) => [
              styles.refreshButton,
              (pressed || isSyncing) && styles.refreshButtonPressed,
            ]}>
            <Text style={styles.refreshButtonText}>
              {isSyncing ? 'Actualizando...' : 'Actualizar datos'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ultimos eventos</Text>
        {history.length === 0 ? (
          <Text style={styles.sectionHelp}>Todavia no hay eventos registrados.</Text>
        ) : null}
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
  label,
  max,
  min,
  normalText,
  unit,
  value,
}: {
  color: string;
  label: string;
  max: number;
  min: number;
  normalText: string;
  unit: string;
  value: number | null;
}) {
  const progress = value === null ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <View style={styles.vitalCard}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <View style={styles.vitalValueRow}>
        <Text style={styles.vitalValue}>{value ?? '--'}</Text>
        {value !== null ? <Text style={styles.vitalUnit}>{unit}</Text> : null}
      </View>
      <View style={styles.vitalTrack}>
        <View style={[styles.vitalFill, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.vitalNormal}>{value === null ? 'Sin lectura valida' : normalText}</Text>
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
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: 150,
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
  refreshButton: {
    alignItems: 'center',
    backgroundColor: appColors.primary,
    borderRadius: 12,
    minHeight: 40,
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
  },
  refreshButtonPressed: {
    opacity: 0.65,
  },
  refreshButtonText: {
    color: appColors.buttonText,
    fontSize: 13,
    fontWeight: '900',
  },
  syncError: {
    color: appColors.danger,
    fontSize: 12,
    lineHeight: 17,
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
    flexWrap: 'wrap',
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
