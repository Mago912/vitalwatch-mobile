import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DeviceDisplayView,
  Medication,
  targetFirmwareVersion,
  targetSystemVersion,
  VitalSigns,
  WatchStatus,
} from '@/constants/vitalwatch';

type VirtualTftProps = {
  battery: number | null;
  connected: boolean;
  displayView: DeviceDisplayView;
  isDisplayControlSyncing: boolean;
  isMedicationSyncing: boolean;
  lastUpdated: string;
  medications: Medication[];
  onDismissImpactAlert: () => Promise<boolean>;
  onMarkMedicationPending: (id: string) => Promise<boolean>;
  onMarkMedicationTaken: (id: string) => Promise<boolean>;
  onRefreshData: () => Promise<void>;
  status: WatchStatus;
  vitals: VitalSigns;
  onViewChange: (view: DeviceDisplayView) => Promise<boolean>;
};

type MenuItem = {
  description: string;
  title: string;
  view: Exclude<DeviceDisplayView, 'menu'>;
};

const menuItems: MenuItem[] = [
  { title: 'SIGNOS', description: 'Pulso y SpO2', view: 'vitals' },
  { title: 'MOVIMIENTO', description: 'Revisar sensor IMU', view: 'movement' },
  { title: 'ESTADO', description: 'Estado del equipo', view: 'status' },
  { title: 'MEDICACION', description: 'Horarios y tomas', view: 'medication' },
];

export function VirtualTft({
  battery,
  connected,
  displayView,
  isDisplayControlSyncing,
  isMedicationSyncing,
  lastUpdated,
  medications,
  onDismissImpactAlert,
  onMarkMedicationPending,
  onMarkMedicationTaken,
  onRefreshData,
  onViewChange,
  status,
  vitals,
}: VirtualTftProps) {
  const longPressHandled = useRef(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [medicationIndex, setMedicationIndex] = useState(0);
  const [view, setView] = useState<DeviceDisplayView>('menu');
  const [message, setMessage] = useState('Pantalla virtual lista.');

  useEffect(() => {
    setView(displayView);
  }, [displayView]);

  useEffect(() => {
    if (medications.length === 0) {
      setMedicationIndex(0);
      return;
    }

    setMedicationIndex((current) => Math.min(current, medications.length - 1));
  }, [medications.length]);

  async function changeView(nextView: DeviceDisplayView) {
    setView(nextView);
    setMessage(`Enviando vista ${viewLabel(nextView)} a BIOSYS...`);
    const sent = await onViewChange(nextView);
    setMessage(
      sent
        ? `${viewLabel(nextView)} enviado a la pulsera.`
        : 'No se pudo sincronizar la vista con la pulsera.'
    );
  }

  function previous() {
    if (view === 'menu') {
      setMenuIndex((current) => (current + menuItems.length - 1) % menuItems.length);
      return;
    }

    if (view === 'medication' && medications.length > 0) {
      setMedicationIndex((current) => (current + medications.length - 1) % medications.length);
    }
  }

  function next() {
    if (view === 'menu') {
      setMenuIndex((current) => (current + 1) % menuItems.length);
      return;
    }

    if (view === 'medication' && medications.length > 0) {
      setMedicationIndex((current) => (current + 1) % medications.length);
    }
  }

  async function select() {
    if (longPressHandled.current) return;

    if (status === 'Caida detectada' || status === 'SOS') {
      setMessage('Enviando OK a BIOSYS...');
      const dismissed = await onDismissImpactAlert();
      setMessage(
        dismissed
          ? 'Alerta cerrada y confirmada por BIOSYS.'
          : 'OK enviado; falta confirmacion de la pulsera.'
      );
      return;
    }

    if (view === 'menu') {
      await changeView(menuItems[menuIndex].view);
      return;
    }

    await changeView('menu');
  }

  async function longSelect() {
    longPressHandled.current = true;

    if (view === 'medication') {
      const medication = medications[medicationIndex];
      if (!medication) {
        setMessage('No hay medicamentos para confirmar.');
        return;
      }

      const willBePending = medication.status === 'Tomado';
      setMessage(
        willBePending ? `Volviendo ${medication.name} a pendiente...` : `Confirmando ${medication.name}...`
      );
      const saved = willBePending
        ? await onMarkMedicationPending(medication.id)
        : await onMarkMedicationTaken(medication.id);
      setMessage(
        saved
          ? willBePending
            ? 'Medicacion marcada como pendiente.'
            : 'Medicacion marcada como tomada.'
          : 'No se pudo guardar el cambio.'
      );
      return;
    }

    setMessage('Actualizando datos de la pulsera...');
    await onRefreshData();
    setMessage('Datos actualizados.');
  }

  const medication = medications[medicationIndex];

  return (
    <View style={styles.wrapper}>
      <View style={styles.case}>
        <View style={styles.screen}>
          <TftTopBar battery={battery} connected={connected} />
          <View style={styles.content}>
            {status === 'Caida detectada' || status === 'SOS' ? (
              <ImpactAlertView status={status} />
            ) : null}
            {status !== 'Caida detectada' && status !== 'SOS' && view === 'menu' ? <MenuView index={menuIndex} /> : null}
            {status !== 'Caida detectada' && status !== 'SOS' && view === 'vitals' ? <VitalsView vitals={vitals} /> : null}
            {status !== 'Caida detectada' && status !== 'SOS' && view === 'movement' ? (
              <MovementView movement={vitals.movement} status={status} />
            ) : null}
            {status !== 'Caida detectada' && status !== 'SOS' && view === 'status' ? (
              <SystemView
                connected={connected}
              />
            ) : null}
            {status !== 'Caida detectada' && status !== 'SOS' && view === 'medication' ? (
              <MedicationView
                index={medicationIndex}
                medication={medication}
                total={medications.length}
              />
            ) : null}
          </View>
          <View style={styles.footer}>
            <Text numberOfLines={1} style={styles.footerText}>
              {status === 'Caida detectada' || status === 'SOS'
                ? 'OK cerrar alerta'
                : view === 'menu'
                ? '<  OK elegir  >'
                : view === 'medication'
                  ? '<  OK volver  > | OK+ toma'
                  : 'OK volver | OK+ actualizar'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <TftButton accessibilityLabel="Anterior" label="<" onPress={previous} />
        <Pressable
          accessibilityHint="Mantener presionado actualiza datos o confirma una toma"
          accessibilityLabel="Aceptar"
          accessibilityRole="button"
          delayLongPress={700}
          disabled={isMedicationSyncing || isDisplayControlSyncing}
          onLongPress={() => void longSelect()}
          onPress={() => void select()}
          onPressIn={() => {
            longPressHandled.current = false;
          }}
          style={({ pressed }) => [
            styles.okButton,
            pressed && styles.controlPressed,
            (isMedicationSyncing || isDisplayControlSyncing) && styles.controlDisabled,
          ]}>
          <Text style={styles.okButtonText}>OK</Text>
          <Text style={styles.okHint}>mantener: OK+</Text>
        </Pressable>
        <TftButton accessibilityLabel="Siguiente" label=">" onPress={next} />
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.message}>
        {message} Ultimo dato: {lastUpdated}
      </Text>
    </View>
  );
}

function ImpactAlertView({ status }: { status: 'Caida detectada' | 'SOS' }) {
  return (
    <View style={styles.centeredContent}>
      <Text style={styles.alertIcon}>!</Text>
      <Text style={styles.alertTitle}>{status === 'SOS' ? 'SOS ACTIVO' : 'POSIBLE IMPACTO'}</Text>
      <Text style={styles.whiteText}>Revisar a la persona</Text>
      <Text style={styles.yellow}>OK para cerrar</Text>
    </View>
  );
}

function TftTopBar({ battery, connected }: { battery: number | null; connected: boolean }) {
  const now = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.topBar}>
      <Text style={[styles.topText, connected ? styles.green : styles.yellow]}>
        {connected ? 'BD' : 'DEMO'}
      </Text>
      <Text style={styles.topText}>{battery === null ? '--' : `${battery}%`}</Text>
      <Text style={styles.topText}>{now}</Text>
    </View>
  );
}

function MenuView({ index }: { index: number }) {
  const item = menuItems[index];

  return (
    <View style={styles.centeredContent}>
      <Text style={styles.heartWatermark}>♥</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.menuTitle}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={styles.cyanText}>
        {item.description}
      </Text>
      <Text style={styles.dimText}>
        {index + 1}/{menuItems.length}
      </Text>
    </View>
  );
}

function VitalsView({ vitals }: { vitals: VitalSigns }) {
  return (
    <View style={styles.viewContent}>
      <Text style={styles.viewTitle}>SIGNOS VITALES</Text>
      <View style={styles.vitalColumns}>
        <View style={styles.vitalColumn}>
          <Text style={styles.dimText}>PULSO</Text>
          <Text style={[styles.bigValue, styles.green]}>{vitals.heartRate ?? '--'}</Text>
          <Text style={styles.dimText}>bpm</Text>
        </View>
        <View style={styles.vitalDivider} />
        <View style={styles.vitalColumn}>
          <Text style={styles.dimText}>SpO2</Text>
          <Text style={[styles.bigValue, styles.cyan]}>{vitals.oxygen === null ? '--' : `${vitals.oxygen}%`}</Text>
          <Text style={styles.dimText}>oxigeno</Text>
        </View>
      </View>
      <Text style={styles.dimText}>
        {vitals.heartRate === null || vitals.oxygen === null ? 'Faltan lecturas validas' : 'Calidad no informada'}
      </Text>
      <Text style={styles.yellow}>LECTURA EXPERIMENTAL</Text>
    </View>
  );
}

function MovementView({ movement, status }: { movement: VitalSigns['movement']; status: WatchStatus }) {
  const isFall = movement === 'Caida' || status === 'Caida detectada';

  return (
    <View style={styles.viewContent}>
      <Text style={styles.viewTitle}>MOVIMIENTO</Text>
      <Text style={styles.whiteText}>MPU6500</Text>
      <Text style={[styles.movementValue, isFall ? styles.red : styles.green]}>{movement}</Text>
      <Text style={styles.whiteText}>{isFall ? 'Impacto detectado' : 'Sin alerta de impacto'}</Text>
      <Text style={styles.dimText}>Segun los datos disponibles</Text>
      <Text style={styles.yellow}>Umbrales: experimental</Text>
    </View>
  );
}

function SystemView({
  connected,
}: {
  connected: boolean;
}) {
  return (
    <View style={styles.viewContent}>
      <Text style={styles.viewTitle}>ESTADO DEL EQUIPO</Text>
      <StatusRow label="IMU" />
      <StatusRow label="MAX30102" />
      <StatusRow label="WiFi ESP32" />
      <Text style={styles.dimText}>{targetFirmwareVersion}</Text>
      <Text style={styles.dimText}>{targetSystemVersion}</Text>
      <Text style={styles.yellow}>{connected ? 'Fuente: base de datos' : 'Fuente: simulacion'}</Text>
    </View>
  );
}

function StatusRow({ label }: { label: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.whiteText}>{label}</Text>
      <Text style={styles.dimText}>Sin datos</Text>
    </View>
  );
}

function MedicationView({
  index,
  medication,
  total,
}: {
  index: number;
  medication: Medication | undefined;
  total: number;
}) {
  if (!medication) {
    return (
      <View style={styles.viewContent}>
        <Text style={styles.viewTitle}>MEDICACION</Text>
        <Text style={styles.whiteText}>SIN MEDICAMENTOS</Text>
        <Text style={styles.dimText}>Esperando Supabase</Text>
        <Text style={styles.cyanText}>OK+ actualizar</Text>
      </View>
    );
  }

  const isTaken = medication.status === 'Tomado';

  return (
    <View style={styles.viewContent}>
      <Text style={styles.viewTitle}>MEDICACION</Text>
      <Text style={styles.green}>
        LISTO {index + 1}/{total}
      </Text>
      <Text style={styles.dimText}>{formatDate(medication.nextDate || medication.date)}</Text>
      <Text style={styles.medicationTime}>{medication.time}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.whiteText}>
        {medication.name}
      </Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cyanText}>
        {medication.dose}
      </Text>
      <View style={[styles.medicationState, isTaken ? styles.stateTaken : styles.statePending]}>
        <Text style={styles.medicationStateText}>{isTaken ? 'TOMADO' : 'PENDIENTE'}</Text>
      </View>
    </View>
  );
}

function TftButton({
  accessibilityLabel,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}>
      <Text style={styles.controlButtonText}>{label}</Text>
    </Pressable>
  );
}

function viewLabel(view: DeviceDisplayView) {
  switch (view) {
    case 'vitals':
      return 'Signos vitales';
    case 'movement':
      return 'Movimiento';
    case 'status':
      return 'Estado';
    case 'medication':
      return 'Medicacion';
    default:
      return 'Menu';
  }
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const colors = {
  black: '#03080A',
  cyan: '#22D3EE',
  dim: '#94A3B8',
  green: '#39E58C',
  red: '#FF4D4D',
  white: '#F8FAFC',
  yellow: '#FACC15',
};

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 14, width: '100%' },
  case: {
    aspectRatio: 1,
    backgroundColor: '#242C30',
    borderColor: '#3F4C52',
    borderRadius: 8,
    borderWidth: 5,
    maxWidth: 360,
    padding: 8,
    width: '100%',
  },
  screen: {
    backgroundColor: colors.black,
    borderColor: '#10191D',
    borderRadius: 3,
    borderWidth: 2,
    flex: 1,
    overflow: 'hidden',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#082F49',
    borderBottomColor: '#0A7EA4',
    borderBottomWidth: 2,
    flexDirection: 'row',
    height: '12%',
    justifyContent: 'space-around',
  },
  topText: {
    color: colors.white,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  content: { flex: 1 },
  centeredContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  heartWatermark: {
    color: '#113540',
    fontSize: 88,
    lineHeight: 90,
    position: 'absolute',
  },
  alertIcon: {
    color: colors.red,
    fontFamily: 'monospace',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 52,
  },
  alertTitle: {
    color: colors.red,
    fontFamily: 'monospace',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  menuTitle: {
    color: colors.white,
    fontFamily: 'monospace',
    fontSize: 26,
    fontWeight: '900',
    zIndex: 1,
  },
  viewContent: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  viewTitle: {
    color: colors.cyan,
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  whiteText: {
    color: colors.white,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  cyanText: {
    color: colors.cyan,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  dimText: {
    color: colors.dim,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  green: { color: colors.green, fontFamily: 'monospace', fontWeight: '900' },
  yellow: { color: colors.yellow, fontFamily: 'monospace', fontWeight: '900' },
  red: { color: colors.red, fontFamily: 'monospace', fontWeight: '900' },
  cyan: { color: colors.cyan },
  vitalColumns: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  vitalColumn: { alignItems: 'center', flex: 1 },
  vitalDivider: { backgroundColor: '#334155', height: 58, width: 1 },
  bigValue: {
    fontFamily: 'monospace',
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  movementValue: { fontSize: 27, fontWeight: '900', textTransform: 'uppercase' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 230,
    width: '100%',
  },
  medicationTime: {
    color: colors.cyan,
    fontFamily: 'monospace',
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  medicationState: {
    alignItems: 'center',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 28,
    width: '92%',
  },
  stateTaken: { backgroundColor: colors.green },
  statePending: { backgroundColor: colors.yellow },
  medicationStateText: {
    color: colors.black,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
  },
  footer: {
    alignItems: 'center',
    backgroundColor: '#1E293B',
    height: '12%',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  footerText: {
    color: colors.white,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 72,
  },
  controlButtonText: { color: '#102027', fontSize: 27, fontWeight: '900' },
  okButton: {
    alignItems: 'center',
    backgroundColor: '#0A7EA4',
    borderRadius: 8,
    height: 70,
    justifyContent: 'center',
    width: 92,
  },
  okButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  okHint: { color: '#CFFAFE', fontSize: 10, fontWeight: '800' },
  controlPressed: { opacity: 0.62, transform: [{ scale: 0.97 }] },
  controlDisabled: { opacity: 0.5 },
  message: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 360,
    textAlign: 'center',
  },
});
