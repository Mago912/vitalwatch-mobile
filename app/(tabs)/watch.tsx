import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { VirtualTft } from '@/components/virtual-tft';
import { VitalWatchLogo } from '@/components/vitalwatch-logo';
import {
  appColors,
  DeviceDisplayView,
  deviceDisplayViews,
} from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

export default function WatchScreen() {
  const {
    backendReachable,
    battery,
    dismissImpactAlert,
    displayControl,
    displayControlMessage,
    isDisplayControlSyncing,
    isMedicationSyncing,
    lastUpdated,
    markMedicationTaken,
    markMedicationPending,
    medications,
    refreshRemoteData,
    readingStatus,
    setDisplayEnabled,
    setDisplayView,
    status,
    vitals,
  } = useVitalWatch();
  const synchronizedView = displayControl.reportedView ?? displayControl.desiredView;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <VitalWatchLogo compact />
        <Text style={styles.title}>Control de pulsera</Text>
        <Text style={styles.subtitle}>
          Usa el mismo menu de la TFT aunque la pantalla fisica este apagada.
        </Text>
      </View>

      <View style={styles.liveRow}>
        <View style={[styles.liveDot, backendReachable && styles.liveDotConnected]} />
        <Text style={styles.liveText}>
          Base de datos {backendReachable ? 'disponible' : 'sin conexion'} · {readingStatus}
        </Text>
      </View>

      <VirtualTft
        battery={battery}
        connected={backendReachable}
        displayView={synchronizedView}
        isDisplayControlSyncing={isDisplayControlSyncing}
        isMedicationSyncing={isMedicationSyncing}
        lastUpdated={lastUpdated}
        medications={medications}
        onDismissImpactAlert={dismissImpactAlert}
        onMarkMedicationPending={markMedicationPending}
        onMarkMedicationTaken={markMedicationTaken}
        onRefreshData={refreshRemoteData}
        onViewChange={setDisplayView}
        status={status}
        vitals={vitals}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pantalla física</Text>
        <Text style={styles.sectionHelp}>
          Todos los controles de la TFT están ahora en Pulsera. Las alertas de impacto tienen
          prioridad; el botón OK virtual también se envía al ESP32.
        </Text>

        <View style={styles.displayStatusBox}>
          <Text style={styles.displayStatusLabel}>Solicitado</Text>
          <Text style={styles.displayStatusValue}>
            {displayControl.desiredOn
              ? `Encendida: ${displayViewLabel(displayControl.desiredView)}`
              : 'Pantalla apagada'}
          </Text>
          <Text style={styles.displayStatusLabel}>Confirmado por BIOSYS</Text>
          <Text style={styles.displayStatusValue}>
            {displayControl.reportedOn === null
              ? 'Sin confirmación todavía'
              : displayControl.reportedOn
                ? `Encendida: ${displayViewLabel(displayControl.reportedView)}`
                : 'Pantalla apagada'}
          </Text>
        </View>

        <View style={styles.displayActions}>
          <Pressable
            disabled={isDisplayControlSyncing}
            onPress={() => void setDisplayEnabled(true)}
            style={({ pressed }) => [
              styles.displayButton,
              styles.displayButtonOn,
              pressed && styles.sendButtonPressed,
              isDisplayControlSyncing && styles.disabledButton,
            ]}>
            <Text style={styles.displayButtonText}>Encender</Text>
          </Pressable>
          <Pressable
            disabled={isDisplayControlSyncing}
            onPress={() => void setDisplayEnabled(false)}
            style={({ pressed }) => [
              styles.displayButton,
              styles.displayButtonOff,
              pressed && styles.sendButtonPressed,
              isDisplayControlSyncing && styles.disabledButton,
            ]}>
            <Text style={styles.displayButtonText}>Apagar</Text>
          </Pressable>
        </View>

        <Text style={styles.displayPickerTitle}>Mostrar directamente en la pulsera</Text>
        <View style={styles.displayViewGrid}>
          {deviceDisplayViews.map((option) => {
            const isActive = displayControl.desiredOn && displayControl.desiredView === option.value;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                disabled={isDisplayControlSyncing}
                key={option.value}
                onPress={() => void setDisplayView(option.value)}
                style={({ pressed }) => [
                  styles.displayViewButton,
                  isActive && styles.displayViewButtonActive,
                  pressed && styles.sendButtonPressed,
                  isDisplayControlSyncing && styles.disabledButton,
                ]}>
                <Text
                  style={[
                    styles.displayViewButtonText,
                    isActive && styles.displayViewButtonTextActive,
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text accessibilityLiveRegion="polite" style={styles.controlMessage}>
          {displayControlMessage}
        </Text>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Controles</Text>
        <Text style={styles.noteText}>
          Izquierda y derecha recorren opciones. OK abre la vista elegida tambien en la TFT fisica.
          Manten OK dentro de Medicacion para alternar entre pendiente y tomado.
        </Text>
      </View>
    </ScrollView>
  );
}

function displayViewLabel(view: DeviceDisplayView | null) {
  if (!view) return 'Sin confirmación todavía';
  return deviceDisplayViews.find((option) => option.value === view)?.label ?? view;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: appColors.background, flex: 1 },
  content: { gap: 18, padding: 20, paddingBottom: 120 },
  appName: { color: appColors.primary, fontSize: 16, fontWeight: '800' },
  title: { color: appColors.text, fontSize: 32, fontWeight: '900' },
  subtitle: {
    color: appColors.muted,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 4,
  },
  liveRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: { backgroundColor: '#F59E0B', borderRadius: 999, height: 9, width: 9 },
  liveDotConnected: { backgroundColor: '#0E9F6E' },
  liveText: { color: '#334155', fontSize: 13, fontWeight: '900' },
  section: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  sectionTitle: { color: appColors.text, fontSize: 21, fontWeight: '900' },
  sectionHelp: { color: appColors.muted, fontSize: 15, lineHeight: 22 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: appColors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
  },
  sendButtonPressed: { backgroundColor: '#075985' },
  disabledButton: { opacity: 0.55 },
  sendButtonText: {
    color: appColors.buttonText,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  controlMessage: { color: appColors.muted, fontSize: 13, lineHeight: 18 },
  displayStatusBox: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  displayStatusLabel: { color: appColors.muted, fontSize: 12, fontWeight: '800' },
  displayStatusValue: { color: appColors.text, fontSize: 15, fontWeight: '900', marginBottom: 6 },
  displayActions: { flexDirection: 'row', gap: 10 },
  displayButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
  },
  displayButtonOn: { backgroundColor: '#0E9F6E' },
  displayButtonOff: { backgroundColor: '#475569' },
  displayButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  displayPickerTitle: { color: appColors.text, fontSize: 15, fontWeight: '900' },
  displayViewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  displayViewButton: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  displayViewButtonActive: { backgroundColor: '#E0F2FE', borderColor: appColors.primary },
  displayViewButtonText: { color: appColors.muted, fontSize: 14, fontWeight: '800' },
  displayViewButtonTextActive: { color: '#075985' },
  note: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  noteTitle: { color: '#075985', fontSize: 17, fontWeight: '900' },
  noteText: { color: '#0C4A6E', fontSize: 14, lineHeight: 21 },
});
