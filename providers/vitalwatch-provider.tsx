import React, { createContext, PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';

import {
  DeviceConnection,
  DeviceDisplayControl,
  DeviceDisplayView,
  deviceDisplayViews,
  EventItem,
  initialDeviceConnection,
  initialDeviceDisplayControl,
  initialHistory,
  initialMedications,
  initialProfile,
  initialVitalSigns,
  Medication,
  UserProfile,
  VitalSigns,
  WatchStatus,
} from '@/constants/vitalwatch';
import {
  getExpoPushToken,
  requestNotificationPermissions,
  showLocalNotification,
} from '@/lib/vitalwatch-notifications';
import { registerDevicePushToken } from '@/lib/vitalwatch-push';
import {
  setRemoteDisplayEnabled,
  setRemoteDisplayView,
  waitForRemoteDisplayConfirmation,
} from '@/lib/vitalwatch-device-control';
import { DashboardEvent, fetchDashboardSnapshot } from '@/lib/vitalwatch-api';
import {
  createRemoteMedication,
  deleteRemoteMedication,
  fetchRemoteMedications,
  setRemoteMedicationStatus,
  updateRemoteMedication,
} from '@/lib/vitalwatch-medications';
import {
  loadDeviceConnection,
  loadHistory,
  loadMedications,
  loadProfile,
  saveDeviceConnection,
  saveHistory,
  saveMedications,
  saveProfile,
} from '@/lib/vitalwatch-storage';

type VitalWatchContextValue = {
  battery: number;
  dataSource: 'Simulacion' | 'Supabase';
  deviceConnection: DeviceConnection;
  displayControl: DeviceDisplayControl;
  displayControlMessage: string;
  history: EventItem[];
  isSyncing: boolean;
  isMedicationSyncing: boolean;
  isDisplayControlSyncing: boolean;
  lastUpdated: string;
  medications: Medication[];
  medicationSyncMessage: string;
  notificationPermission: boolean;
  profile: UserProfile;
  pushNotificationMessage: string;
  pushNotificationStatus: 'Pendientes' | 'Registrando' | 'Activas' | 'Error';
  status: WatchStatus;
  syncError: string | null;
  vitals: VitalSigns;
  activateFall: () => void;
  activateLowBattery: () => void;
  activateMedicationReminder: () => void;
  activateNormal: () => void;
  activateSos: () => void;
  addMedication: (medication: Omit<Medication, 'id' | 'status'>) => Promise<boolean>;
  deleteMedication: (id: string) => Promise<boolean>;
  markMedicationTaken: (id: string) => Promise<boolean>;
  markMedicationPending: (id: string) => Promise<boolean>;
  refreshMedications: () => Promise<boolean>;
  refreshRemoteData: () => Promise<void>;
  retryPushNotifications: () => Promise<void>;
  setDisplayEnabled: (enabled: boolean) => Promise<boolean>;
  setDisplayView: (view: DeviceDisplayView) => Promise<boolean>;
  updateDeviceConnection: (deviceConnection: DeviceConnection) => void;
  updateMedication: (medication: Medication) => Promise<boolean>;
  updateProfile: (profile: UserProfile) => void;
};

const VitalWatchContext = createContext<VitalWatchContextValue | null>(null);
const REMOTE_REFRESH_MS = 15000;

function getDisplayViewLabel(view: DeviceDisplayView) {
  return deviceDisplayViews.find((option) => option.value === view)?.label ?? view;
}

function formatDateTime() {
  return new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRemoteDateTime(value: string) {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getRemoteStatus(events: DashboardEvent[], heartRate: number, oxygen: number): WatchStatus {
  const latestEvent = events[0]?.type;

  if (latestEvent === 'sos') {
    return 'SOS';
  }

  if (latestEvent === 'fall_detected') {
    return 'Caida detectada';
  }

  if (latestEvent === 'battery_low' || latestEvent === 'heart_rate_high' || latestEvent === 'spo2_low') {
    return 'Alerta';
  }

  if (latestEvent === 'medication_pending') {
    return 'Medicacion pendiente';
  }

  if (heartRate >= 110 || oxygen <= 92) {
    return 'SOS';
  }

  if (heartRate >= 100 || oxygen <= 94) {
    return 'Alerta';
  }

  return 'Normal';
}

function getRemoteEventLabel(type: string) {
  const labels: Record<string, string> = {
    battery_low: 'Bateria baja',
    fall_detected: 'Caida detectada',
    heart_rate_high: 'Ritmo cardiaco alto',
    medication_pending: 'Medicacion pendiente',
    medication_taken: 'Medicacion tomada',
    normal_status: 'Estado normal',
    performance_mode_enabled: 'Modo rendimiento activado',
    sos: 'SOS activado',
    spo2_low: 'Oxigeno bajo',
  };

  return labels[type] ?? type;
}

function createEvent(type: string, description: string): EventItem {
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    description,
    date: formatDateTime(),
  };
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTrend(previousHeartRate: number, nextHeartRate: number) {
  const difference = nextHeartRate - previousHeartRate;

  if (difference >= 2) {
    return 'sube' as const;
  }

  if (difference <= -2) {
    return 'baja' as const;
  }

  return 'estable' as const;
}

function simulateVitalSigns(status: WatchStatus, previousVitals: VitalSigns): VitalSigns {
  let nextVitals: Omit<VitalSigns, 'trend'>;

  if (status === 'SOS') {
    nextVitals = {
      heartRate: randomBetween(105, 122),
      oxygen: randomBetween(92, 95),
      movement: 'Activo',
    };
  } else if (status === 'Caida detectada') {
    nextVitals = {
      heartRate: randomBetween(92, 112),
      oxygen: randomBetween(93, 97),
      movement: 'Caida',
    };
  } else if (status === 'Alerta') {
    nextVitals = {
      heartRate: randomBetween(82, 98),
      oxygen: randomBetween(94, 98),
      movement: 'Leve',
    };
  } else {
    nextVitals = {
      heartRate: randomBetween(68, 84),
      oxygen: randomBetween(96, 99),
      movement: Math.random() > 0.78 ? 'Leve' : 'Reposo',
    };
  }

  return {
    ...nextVitals,
    trend: getTrend(previousVitals.heartRate, nextVitals.heartRate),
  };
}

export function VitalWatchProvider({ children }: PropsWithChildren) {
  const latestRemoteEventId = useRef<number | null>(null);
  const notificationPermissionRef = useRef(false);
  const registeredPushDeviceCode = useRef<string | null>(null);
  const remoteDeviceCode = useRef<string | null>(null);
  const remoteDeviceId = useRef<number | null>(null);
  const remotePushIsActive = useRef(false);
  const pushRegistrationInProgress = useRef(false);
  const [battery, setBattery] = useState(86);
  const [dataSource, setDataSource] = useState<'Simulacion' | 'Supabase'>('Simulacion');
  const [deviceConnection, setDeviceConnection] = useState<DeviceConnection>(initialDeviceConnection);
  const [displayControl, setDisplayControl] = useState<DeviceDisplayControl>(
    initialDeviceDisplayControl
  );
  const [displayControlMessage, setDisplayControlMessage] = useState(
    'Esperando la primera confirmacion del ESP32.'
  );
  const [history, setHistory] = useState<EventItem[]>(initialHistory);
  const [isMedicationSyncing, setIsMedicationSyncing] = useState(false);
  const [isDisplayControlSyncing, setIsDisplayControlSyncing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(formatDateTime());
  const [medications, setMedications] = useState<Medication[]>(initialMedications);
  const [medicationSyncMessage, setMedicationSyncMessage] = useState(
    'Mostrando los medicamentos guardados en este celular.'
  );
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [pushNotificationMessage, setPushNotificationMessage] = useState(
    'Esperando la conexion con la pulsera.'
  );
  const [pushNotificationStatus, setPushNotificationStatus] =
    useState<VitalWatchContextValue['pushNotificationStatus']>('Pendientes');
  const [status, setStatus] = useState<WatchStatus>('Normal');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [vitals, setVitals] = useState<VitalSigns>(initialVitalSigns);

  useEffect(() => {
    async function prepareApp() {
      const [savedProfile, savedMedications, savedHistory, savedDeviceConnection] = await Promise.all([
        loadProfile(initialProfile),
        loadMedications(initialMedications),
        loadHistory(initialHistory),
        loadDeviceConnection(initialDeviceConnection),
      ]);

      setProfile(savedProfile);
      setMedications(savedMedications);
      setHistory(savedHistory);
      setDeviceConnection(savedDeviceConnection);

      try {
        const permissionWasGranted = await requestNotificationPermissions();
        notificationPermissionRef.current = permissionWasGranted;
        setNotificationPermission(permissionWasGranted);

        if (!permissionWasGranted) {
          setPushNotificationStatus('Error');
          setPushNotificationMessage(
            'El permiso esta desactivado. Usa Abrir permisos de Android para habilitarlo.'
          );
        }
      } catch (error) {
        notificationPermissionRef.current = false;
        setNotificationPermission(false);
        setPushNotificationStatus('Error');
        setPushNotificationMessage(
          `No se pudo comprobar el permiso: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      await refreshRemoteData();
    }

    prepareApp();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void refreshRemoteData();
    }, REMOTE_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (dataSource === 'Supabase') {
      return undefined;
    }

    const intervalId = setInterval(() => {
      // Esta simulacion reemplaza por ahora a los sensores reales del ESP32.
      setVitals((currentVitals) => simulateVitalSigns(status, currentVitals));
      setLastUpdated(formatDateTime());
    }, 3500);

    return () => clearInterval(intervalId);
  }, [dataSource, status]);

  async function refreshRemoteData() {
    setIsSyncing(true);

    try {
      const snapshot = await fetchDashboardSnapshot();
      const latestRemoteEvent = snapshot.events[0];

      if (latestRemoteEvent) {
        if (
          latestRemoteEventId.current !== null &&
          latestRemoteEventId.current !== latestRemoteEvent.id &&
          latestRemoteEvent.type !== 'normal_status' &&
          !remotePushIsActive.current
        ) {
          void showLocalNotification('Alerta VitalWatch', latestRemoteEvent.message);
        }

        latestRemoteEventId.current = latestRemoteEvent.id;
      }

      const remoteProfile: UserProfile = {
        elderName: snapshot.user.name,
        contactName: snapshot.user.contactName,
        contactInfo: '',
      };
      const remoteConnection: DeviceConnection = {
        deviceName: `${snapshot.device.name} (${snapshot.device.code})`,
        connectionMode: 'API',
        endpoint: 'Supabase',
      };

      remoteDeviceCode.current = snapshot.device.code;
      remoteDeviceId.current = snapshot.device.id;
      const remoteDisplayControl: DeviceDisplayControl = {
        commandAt: snapshot.device.displayCommandAt,
        desiredOn: snapshot.device.desiredDisplayOn,
        desiredView: snapshot.device.desiredDisplayView,
        reportedAt: snapshot.device.displayReportedAt,
        reportedOn: snapshot.device.reportedDisplayOn,
        reportedView: snapshot.device.reportedDisplayView,
      };
      setDisplayControl(remoteDisplayControl);
      if (remoteDisplayControl.reportedOn === null) {
        setDisplayControlMessage('Esperando la primera confirmacion del ESP32.');
      } else if (remoteDisplayControl.reportedOn !== remoteDisplayControl.desiredOn) {
        setDisplayControlMessage('Orden enviada. Esperando que la pulsera la aplique.');
      } else if (!remoteDisplayControl.desiredOn) {
        setDisplayControlMessage('El ESP32 confirmo la pantalla apagada.');
      } else if (remoteDisplayControl.reportedView === remoteDisplayControl.desiredView) {
        setDisplayControlMessage(
          `El ESP32 confirmo la vista ${getDisplayViewLabel(remoteDisplayControl.desiredView)}.`
        );
      } else {
        setDisplayControlMessage('Pantalla encendida. Esperando el cambio de vista.');
      }
      await registerRemotePushNotifications(snapshot.device.code);
      await refreshMedications(snapshot.device.code);
      const remoteEvents: EventItem[] = snapshot.events.map((event) => ({
        id: `supabase-${event.id}`,
        type: getRemoteEventLabel(event.type),
        description: event.message,
        date: formatRemoteDateTime(event.eventTime),
      }));

      setProfile(remoteProfile);
      setDeviceConnection(remoteConnection);
      saveProfile(remoteProfile);
      saveDeviceConnection(remoteConnection);

      if (remoteEvents.length > 0) {
        setHistory((currentHistory) => {
          const remoteEventIds = new Set(remoteEvents.map((event) => event.id));
          const preservedEvents = currentHistory.filter((event) => !remoteEventIds.has(event.id));
          const mergedHistory = [...remoteEvents, ...preservedEvents].slice(0, 40);

          void saveHistory(mergedHistory);
          return mergedHistory;
        });
      }

      const remoteReading = snapshot.latestReading;

      if (remoteReading) {
        const heartRate = remoteReading.heartRate ?? initialVitalSigns.heartRate;
        const oxygen = remoteReading.oxygen ?? initialVitalSigns.oxygen;

        setStatus(getRemoteStatus(snapshot.events, heartRate, oxygen));
        setVitals((currentVitals) => {
          return {
            ...currentVitals,
            heartRate,
            oxygen,
            movement:
              snapshot.events[0]?.type === 'fall_detected' || (remoteReading.impact ?? 0) >= 2.5
                ? 'Caida'
                : 'Reposo',
            trend: getTrend(currentVitals.heartRate, heartRate),
          };
        });
        setLastUpdated(formatRemoteDateTime(remoteReading.recordedAt));
      }

      const remoteBattery = remoteReading?.battery ?? snapshot.device.battery;

      if (remoteBattery !== null) {
        setBattery(Math.max(0, Math.min(100, remoteBattery)));
      }

      setDataSource('Supabase');
      setSyncError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al consultar Supabase.';
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function registerRemotePushNotifications(deviceCode: string, force = false) {
    if (!notificationPermissionRef.current) {
      return;
    }

    if (pushRegistrationInProgress.current) {
      return;
    }

    if (!force && registeredPushDeviceCode.current === deviceCode) {
      return;
    }

    pushRegistrationInProgress.current = true;
    setPushNotificationStatus('Registrando');
    setPushNotificationMessage('Registrando este celular para las alertas de la pulsera.');

    try {
      const expoPushToken = await getExpoPushToken(setPushNotificationMessage);
      setPushNotificationMessage('Token Expo obtenido. Guardando el celular en Supabase.');
      await registerDevicePushToken({ deviceCode, expoPushToken });

      registeredPushDeviceCode.current = deviceCode;
      remotePushIsActive.current = true;
      setPushNotificationStatus('Activas');
      setPushNotificationMessage('El celular recibira alertas aunque la app este cerrada.');
    } catch (error) {
      registeredPushDeviceCode.current = null;
      remotePushIsActive.current = false;
      setPushNotificationStatus('Error');
      const message =
        error instanceof Error ? error.message : 'No se pudieron activar las notificaciones remotas.';

      if (message.includes('Default FirebaseApp is not initialized')) {
        setPushNotificationMessage(
          'Esta instalacion no incluye la configuracion FCM de Firebase. Se necesita instalar una nueva APK de VitalWatch.'
        );
      } else {
        setPushNotificationMessage(message);
      }
    } finally {
      pushRegistrationInProgress.current = false;
    }
  }

  async function retryPushNotifications() {
    setPushNotificationStatus('Registrando');
    setPushNotificationMessage('Comprobando el permiso de notificaciones del celular.');

    let permissionWasGranted = false;

    try {
      permissionWasGranted = await requestNotificationPermissions();
      notificationPermissionRef.current = permissionWasGranted;
      setNotificationPermission(permissionWasGranted);
    } catch (error) {
      notificationPermissionRef.current = false;
      setNotificationPermission(false);
      setPushNotificationStatus('Error');
      setPushNotificationMessage(
        `No se pudo comprobar el permiso: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    if (!permissionWasGranted) {
      setPushNotificationStatus('Error');
      setPushNotificationMessage(
        'El permiso esta desactivado. Usa Abrir permisos de Android para habilitarlo.'
      );
      return;
    }

    if (!remoteDeviceCode.current) {
      await refreshRemoteData();

      if (!remoteDeviceCode.current) {
        setPushNotificationStatus('Error');
        setPushNotificationMessage(
          'No se pudo obtener el codigo de la pulsera desde Supabase. Revisa la sincronizacion.'
        );
      }

      return;
    }

    await registerRemotePushNotifications(remoteDeviceCode.current, true);
  }

  async function setDisplayEnabled(enabled: boolean) {
    const deviceId = remoteDeviceId.current;
    if (!deviceId) {
      setDisplayControlMessage('Todavia no se pudo identificar la pulsera vinculada.');
      return false;
    }

    setIsDisplayControlSyncing(true);
    setDisplayControlMessage(
      `Enviando orden para ${enabled ? 'encender' : 'apagar'} la pantalla...`
    );

    try {
      const updatedControl = await setRemoteDisplayEnabled(deviceId, enabled);
      setDisplayControl(updatedControl);
      setDisplayControlMessage('Orden enviada. Esperando la confirmacion del ESP32...');
      const confirmedControl = await waitForRemoteDisplayConfirmation(
        deviceId,
        enabled,
        updatedControl.desiredView
      );
      if (confirmedControl) {
        setDisplayControl(confirmedControl);
        setDisplayControlMessage(
          enabled
            ? `El ESP32 confirmo la vista ${getDisplayViewLabel(confirmedControl.desiredView)}.`
            : 'El ESP32 confirmo la pantalla apagada.'
        );
      } else {
        setDisplayControlMessage('Orden enviada. La pulsera todavia no confirmo el cambio.');
      }
      addHistoryEvent(
        'Control de pantalla',
        `Se solicito ${enabled ? 'encender' : 'apagar'} la pantalla de la pulsera.`
      );
      return true;
    } catch (error) {
      setDisplayControlMessage(
        error instanceof Error ? error.message : 'No se pudo enviar la orden.'
      );
      return false;
    } finally {
      setIsDisplayControlSyncing(false);
    }
  }

  async function setDisplayView(view: DeviceDisplayView) {
    const deviceId = remoteDeviceId.current;
    if (!deviceId) {
      setDisplayControlMessage('Todavia no se pudo identificar la pulsera vinculada.');
      return false;
    }

    setIsDisplayControlSyncing(true);
    setDisplayControlMessage(`Abriendo ${getDisplayViewLabel(view)} en la pulsera...`);

    try {
      const updatedControl = await setRemoteDisplayView(deviceId, view);
      setDisplayControl(updatedControl);
      setDisplayControlMessage('Orden enviada. Esperando la confirmacion del ESP32...');
      const confirmedControl = await waitForRemoteDisplayConfirmation(deviceId, true, view);
      if (confirmedControl) {
        setDisplayControl(confirmedControl);
        setDisplayControlMessage(`El ESP32 confirmo la vista ${getDisplayViewLabel(view)}.`);
      } else {
        setDisplayControlMessage('Orden enviada. La pulsera todavia no confirmo el cambio.');
      }
      addHistoryEvent(
        'Control de pantalla',
        `Se solicito abrir ${getDisplayViewLabel(view)} en la pulsera.`
      );
      return true;
    } catch (error) {
      setDisplayControlMessage(
        error instanceof Error ? error.message : 'No se pudo cambiar la vista.'
      );
      return false;
    } finally {
      setIsDisplayControlSyncing(false);
    }
  }

  function addHistoryEvent(type: string, description: string) {
    const newEvent = createEvent(type, description);

    setHistory((currentHistory) => {
      const updatedHistory = [newEvent, ...currentHistory].slice(0, 40);
      saveHistory(updatedHistory);
      return updatedHistory;
    });

    setLastUpdated(newEvent.date);
  }

  function activateStatus(nextStatus: WatchStatus, eventType: string, description: string, batteryValue?: number) {
    setStatus(nextStatus);

    if (batteryValue !== undefined) {
      setBattery(batteryValue);
    }

    addHistoryEvent(eventType, description);
  }

  function activateNormal() {
    activateStatus('Normal', 'Estado normal', 'Estado normal restaurado.', 86);
    showLocalNotification('VitalWatch', 'Estado normal restaurado.');
  }

  function activateFall() {
    activateStatus('Caida detectada', 'Caida detectada', 'Posible caida detectada por la pulsera.');
    showLocalNotification('Alerta VitalWatch', 'Posible caida detectada.');
  }

  function activateSos() {
    activateStatus('SOS', 'SOS activado', 'SOS activado: revisar al usuario inmediatamente.');
    showLocalNotification('SOS activado', 'Revisar al usuario inmediatamente.');
  }

  function activateLowBattery() {
    activateStatus('Alerta', 'Bateria baja', 'Bateria baja en la pulsera.', 12);
    showLocalNotification('Bateria baja', 'La pulsera VitalWatch tiene bateria baja.');
  }

  function activateMedicationReminder() {
    activateStatus(
      'Medicacion pendiente',
      'Recordatorio de medicacion',
      'Recordatorio de medicacion enviado.'
    );
    showLocalNotification('Recordatorio de medicacion', 'Hay una medicacion pendiente.');
  }

  async function refreshMedications(deviceCode = remoteDeviceCode.current) {
    if (!deviceCode) {
      setMedicationSyncMessage('Esperando el codigo de la pulsera para sincronizar.');
      return false;
    }

    setIsMedicationSyncing(true);

    try {
      const remoteMedications = await fetchRemoteMedications(deviceCode);
      setMedications(remoteMedications);
      await saveMedications(remoteMedications);
      setMedicationSyncMessage('Medicamentos sincronizados con la pulsera.');
      return true;
    } catch (error) {
      setMedicationSyncMessage(
        `Sin conexion: se muestran los datos guardados. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    } finally {
      setIsMedicationSyncing(false);
    }
  }

  async function runMedicationMutation(
    action: (deviceCode: string) => Promise<Medication[]>,
    eventType: string,
    eventDescription: string
  ) {
    const deviceCode = remoteDeviceCode.current;

    if (!deviceCode) {
      setMedicationSyncMessage('Todavia no se pudo vincular la app con la pulsera.');
      return false;
    }

    setIsMedicationSyncing(true);

    try {
      const remoteMedications = await action(deviceCode);
      setMedications(remoteMedications);
      await saveMedications(remoteMedications);
      setMedicationSyncMessage('Cambio guardado en Supabase y disponible para el ESP32.');
      addHistoryEvent(eventType, eventDescription);
      return true;
    } catch (error) {
      setMedicationSyncMessage(
        `No se pudo guardar el cambio: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    } finally {
      setIsMedicationSyncing(false);
    }
  }

  function addMedication(medication: Omit<Medication, 'id' | 'status'>) {
    return runMedicationMutation(
      (deviceCode) => createRemoteMedication(deviceCode, medication),
      'Medicacion agregada',
      `Se agrego ${medication.name}.`
    );
  }

  function updateMedication(updatedMedication: Medication) {
    return runMedicationMutation(
      (deviceCode) => updateRemoteMedication(deviceCode, updatedMedication),
      'Medicacion editada',
      `Se actualizo ${updatedMedication.name}.`
    );
  }

  function deleteMedication(id: string) {
    const medicationToDelete = medications.find((medication) => medication.id === id);

    return runMedicationMutation(
      (deviceCode) => deleteRemoteMedication(deviceCode, id),
      'Medicacion eliminada',
      `Se elimino ${medicationToDelete?.name ?? 'un medicamento'}.`
    );
  }

  function markMedicationTaken(id: string) {
    return runMedicationMutation(
      (deviceCode) => setRemoteMedicationStatus(deviceCode, id, 'taken'),
      'Medicacion tomada',
      'Medicacion marcada como tomada.'
    );
  }

  function markMedicationPending(id: string) {
    return runMedicationMutation(
      (deviceCode) => setRemoteMedicationStatus(deviceCode, id, 'pending'),
      'Medicacion pendiente',
      'Medicacion marcada nuevamente como pendiente.'
    );
  }

  function updateProfile(nextProfile: UserProfile) {
    setProfile(nextProfile);
    saveProfile(nextProfile);
    addHistoryEvent('Configuracion', 'Datos de usuario/contacto actualizados.');
  }

  function updateDeviceConnection(nextDeviceConnection: DeviceConnection) {
    setDeviceConnection(nextDeviceConnection);
    saveDeviceConnection(nextDeviceConnection);
    addHistoryEvent('ESP32', 'Configuracion de conexion futura actualizada.');
  }

  const value = useMemo(
    () => ({
      battery,
      dataSource,
      deviceConnection,
      displayControl,
      displayControlMessage,
      history,
      isMedicationSyncing,
      isDisplayControlSyncing,
      isSyncing,
      lastUpdated,
      medications,
      medicationSyncMessage,
      notificationPermission,
      profile,
      pushNotificationMessage,
      pushNotificationStatus,
      status,
      syncError,
      vitals,
      activateFall,
      activateLowBattery,
      activateMedicationReminder,
      activateNormal,
      activateSos,
      addMedication,
      deleteMedication,
      markMedicationTaken,
      markMedicationPending,
      refreshMedications,
      refreshRemoteData,
      retryPushNotifications,
      setDisplayEnabled,
      setDisplayView,
      updateDeviceConnection,
      updateMedication,
      updateProfile,
    }),
    [
      battery,
      dataSource,
      deviceConnection,
      displayControl,
      displayControlMessage,
      history,
      isMedicationSyncing,
      isDisplayControlSyncing,
      isSyncing,
      lastUpdated,
      medications,
      medicationSyncMessage,
      notificationPermission,
      profile,
      pushNotificationMessage,
      pushNotificationStatus,
      status,
      syncError,
      vitals,
    ]
  );

  return <VitalWatchContext.Provider value={value}>{children}</VitalWatchContext.Provider>;
}

export function useVitalWatch() {
  const context = React.use(VitalWatchContext);

  if (!context) {
    throw new Error('useVitalWatch debe usarse dentro de VitalWatchProvider');
  }

  return context;
}
