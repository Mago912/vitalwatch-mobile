import React, { createContext, PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

import {
  DeviceAlertState,
  DeviceDisplayControl,
  DeviceDisplayView,
  deviceDisplayViews,
  EmergencyContact,
  EventItem,
  initialEmergencyContacts,
  initialDeviceDisplayControl,
  initialHistory,
  initialMedications,
  initialProfile,
  initialVitalSigns,
  Medication,
  ReadingStatus,
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
  sendRemoteOk,
  setRemoteDisplayEnabled,
  setRemoteDisplayView,
  waitForRemoteAlertDismissal,
  waitForRemoteDisplayConfirmation,
} from '@/lib/vitalwatch-device-control';
import { DashboardEvent, fetchDashboardSnapshot } from '@/lib/vitalwatch-api';
import {
  getRemoteReadingStatus,
  getRemoteStatus,
  getTrend,
  readRemoteMeasurements,
} from '@/lib/vitalwatch-readings';
import {
  createRemoteMedication,
  deleteRemoteMedication,
  fetchRemoteMedications,
  setRemoteMedicationStatus,
  updateRemoteMedication,
} from '@/lib/vitalwatch-medications';
import {
  createRemotePhoneContact,
  deleteRemoteEmergencyContact,
  fetchRemoteEmergencyContacts,
  PhoneContactInput,
  setRemoteContactActive,
  updateRemotePhoneContact,
} from '@/lib/vitalwatch-emergency-contacts';
import {
  loadEmergencyContacts,
  loadHistory,
  loadMedications,
  loadProfile,
  saveEmergencyContacts,
  saveHistory,
  saveMedications,
  saveProfile,
} from '@/lib/vitalwatch-storage';
import { supabase } from '@/lib/supabase';

type VitalWatchContextValue = {
  battery: number | null;
  backendReachable: boolean;
  displayControl: DeviceDisplayControl;
  displayControlMessage: string;
  emergencyContacts: EmergencyContact[];
  emergencyContactSyncMessage: string;
  history: EventItem[];
  isContactSyncing: boolean;
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
  readingStatus: ReadingStatus;
  status: WatchStatus;
  syncError: string | null;
  vitals: VitalSigns;
  addMedication: (medication: Omit<Medication, 'id' | 'status'>) => Promise<boolean>;
  addPhoneContact: (contact: PhoneContactInput) => Promise<boolean>;
  deleteEmergencyContact: (id: string) => Promise<boolean>;
  deleteMedication: (id: string) => Promise<boolean>;
  dismissImpactAlert: () => Promise<boolean>;
  markMedicationTaken: (id: string) => Promise<boolean>;
  markMedicationPending: (id: string) => Promise<boolean>;
  refreshMedications: () => Promise<boolean>;
  refreshEmergencyContacts: (force?: boolean) => Promise<boolean>;
  refreshRemoteData: () => Promise<void>;
  retryPushNotifications: () => Promise<void>;
  setDisplayEnabled: (enabled: boolean) => Promise<boolean>;
  setDisplayView: (view: DeviceDisplayView) => Promise<boolean>;
  setEmergencyContactActive: (id: string, active: boolean) => Promise<boolean>;
  updatePhoneContact: (id: string, contact: PhoneContactInput) => Promise<boolean>;
  updateMedication: (medication: Medication) => Promise<boolean>;
  updateProfile: (profile: UserProfile) => void;
};

const VitalWatchContext = createContext<VitalWatchContextValue | null>(null);
// El backend se consulta cada 5 s para que la pantalla principal no quede
// atrasada respecto de la fotografia PPG enviada por BIOSYS.
const REMOTE_REFRESH_MS = 5000;
const MEDICATION_REFRESH_MS = 30_000;
const EMERGENCY_CONTACT_REFRESH_MS = 15_000;

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

function getEffectiveAlertState(
  events: DashboardEvent[],
  reportedState: DeviceAlertState | null,
  reportedAt: string | null
): DeviceAlertState | null {
  const latestCriticalEvent = events.find(
    (event) => event.type === 'fall_detected' || event.type === 'sos'
  );

  if (
    latestCriticalEvent &&
    (!reportedAt || new Date(latestCriticalEvent.eventTime).getTime() > new Date(reportedAt).getTime())
  ) {
    return latestCriticalEvent.type === 'fall_detected' ? 'fall' : 'sos';
  }

  return reportedState;
}

function getRemoteEventLabel(type: string) {
  const labels: Record<string, string> = {
    battery_low: 'Bateria baja',
    call_request: 'LLAMADA',
    device_offline: 'Sin comunicacion',
    device_online: 'Comunicacion restablecida',
    fall_detected: 'Caida detectada',
    heart_rate_abnormal: 'Frecuencia cardiaca fuera del rango',
    heart_rate_high: 'Ritmo cardiaco alto',
    medication_pending: 'Medicacion pendiente',
    medication_taken: 'Medicacion tomada',
    message_request: 'MENSAJE',
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

function normalizeSavedContact(contact: EmergencyContact): EmergencyContact {
  const legacy = contact as EmergencyContact & { phone?: string };
  return {
    active: contact.active ?? true,
    channel: contact.channel ?? (contact.telegramChatId ? 'telegram' : 'sms'),
    id: contact.id,
    name: contact.name,
    phoneNumber: contact.phoneNumber ?? legacy.phone ?? null,
    telegramChatId: contact.telegramChatId ?? null,
    telegramUsername: contact.telegramUsername ?? null,
  };
}

export function VitalWatchProvider({ children }: PropsWithChildren) {
  const latestRemoteEventId = useRef<number | null>(null);
  const emergencyContactsRef = useRef<EmergencyContact[]>(initialEmergencyContacts);
  const emergencyContactSyncInProgress = useRef(false);
  const lastEmergencyContactRefreshAt = useRef(0);
  const remoteContactsLoadedForUser = useRef<number | null>(null);
  const lastMedicationRefreshAt = useRef(0);
  const notificationPermissionRef = useRef(false);
  const registeredPushDeviceCode = useRef<string | null>(null);
  const remoteDeviceCode = useRef<string | null>(null);
  const remoteDeviceId = useRef<number | null>(null);
  const remoteUserId = useRef<number | null>(null);
  const remotePushIsActive = useRef(false);
  const pushRegistrationInProgress = useRef(false);
  const remoteRefreshInProgress = useRef(false);
  const [battery, setBattery] = useState<number | null>(null);
  const [backendReachable, setBackendReachable] = useState(false);
  const [displayControl, setDisplayControl] = useState<DeviceDisplayControl>(
    initialDeviceDisplayControl
  );
  const [displayControlMessage, setDisplayControlMessage] = useState(
    'Esperando la primera confirmacion del ESP32.'
  );
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(
    initialEmergencyContacts
  );
  const [emergencyContactSyncMessage, setEmergencyContactSyncMessage] = useState(
    'Los contactos se guardan localmente hasta vincular la cuenta.'
  );
  const [history, setHistory] = useState<EventItem[]>(initialHistory);
  const [isContactSyncing, setIsContactSyncing] = useState(false);
  const [isMedicationSyncing, setIsMedicationSyncing] = useState(false);
  const [isDisplayControlSyncing, setIsDisplayControlSyncing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(formatDateTime());
  const [linkedDeviceId, setLinkedDeviceId] = useState<number | null>(null);
  const [linkedUserId, setLinkedUserId] = useState<number | null>(null);
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
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('Sin datos');
  const [status, setStatus] = useState<WatchStatus>('Sin lectura');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [vitals, setVitals] = useState<VitalSigns>(initialVitalSigns);

  useEffect(() => {
    async function prepareApp() {
      const [
        savedProfile,
        savedMedications,
        savedHistory,
        savedEmergencyContacts,
      ] = await Promise.all([
        loadProfile(initialProfile),
        loadMedications(initialMedications),
        loadHistory(initialHistory),
        loadEmergencyContacts(initialEmergencyContacts),
      ]);

      setProfile(savedProfile);
      setMedications(savedMedications);
      setHistory(savedHistory);
      // VW-APP-02 — Se preservan tanto telefonos administrados por VitalWatch
      // como chats de Telegram; ya no se descartan contactos telefonicos.
      const migratedEmergencyContacts = savedEmergencyContacts.map(normalizeSavedContact);
      setEmergencyContacts(migratedEmergencyContacts);
      emergencyContactsRef.current = migratedEmergencyContacts;
      void saveEmergencyContacts(migratedEmergencyContacts);

      try {
        const permissionWasGranted = await requestNotificationPermissions();
        notificationPermissionRef.current = permissionWasGranted;
        setNotificationPermission(permissionWasGranted);

        if (!permissionWasGranted) {
          setPushNotificationStatus('Error');
          setPushNotificationMessage(
            'El permiso esta desactivado. Usa Abrir permisos del sistema para habilitarlo.'
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
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshRemoteData();
        void refreshMedications(undefined, true, false);
        if (remoteUserId.current) {
          void refreshEmergencyContactsForUser(remoteUserId.current, true);
        }
      }
    });
    const notificationSubscription = Notifications.addNotificationReceivedListener(() => {
      void refreshRemoteData();
      void refreshMedications(undefined, true, false);
    });

    return () => {
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!linkedDeviceId || !linkedUserId) return;

    let remoteRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let medicationRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let contactRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const queueRemoteRefresh = () => {
      if (remoteRefreshTimer) clearTimeout(remoteRefreshTimer);
      remoteRefreshTimer = setTimeout(() => {
        void refreshRemoteData();
      }, 200);
    };
    const queueMedicationRefresh = () => {
      if (medicationRefreshTimer) clearTimeout(medicationRefreshTimer);
      medicationRefreshTimer = setTimeout(() => {
        void refreshMedications(undefined, true, false);
      }, 200);
    };
    const queueContactRefresh = () => {
      if (contactRefreshTimer) clearTimeout(contactRefreshTimer);
      contactRefreshTimer = setTimeout(() => {
        void refreshEmergencyContactsForUser(linkedUserId, true);
      }, 200);
    };

    const channel = supabase
      .channel(`vitalwatch-live-${linkedDeviceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'devices', filter: `id=eq.${linkedDeviceId}` },
        queueRemoteRefresh
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `device_id=eq.${linkedDeviceId}`,
        },
        queueRemoteRefresh
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'device_events',
          filter: `device_id=eq.${linkedDeviceId}`,
        },
        queueRemoteRefresh
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'medication_logs',
          filter: `device_id=eq.${linkedDeviceId}`,
        },
        queueMedicationRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications',
          filter: `user_id=eq.${linkedUserId}`,
        },
        queueMedicationRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_contacts',
          filter: `user_id=eq.${linkedUserId}`,
        },
        queueContactRefresh
      )
      .subscribe();

    return () => {
      if (remoteRefreshTimer) clearTimeout(remoteRefreshTimer);
      if (medicationRefreshTimer) clearTimeout(medicationRefreshTimer);
      if (contactRefreshTimer) clearTimeout(contactRefreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [linkedDeviceId, linkedUserId]);

  async function refreshRemoteData() {
    if (remoteRefreshInProgress.current) return;
    remoteRefreshInProgress.current = true;
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
          void showLocalNotification('VitalWatch', latestRemoteEvent.message, {
            id: latestRemoteEvent.id,
            type: latestRemoteEvent.type,
          });
        }

        latestRemoteEventId.current = latestRemoteEvent.id;
      }

      const remoteProfile: UserProfile = {
        elderName: snapshot.user.name,
        contactName: snapshot.user.contactName,
        contactInfo: '',
      };
      remoteDeviceCode.current = snapshot.device.code;
      remoteDeviceId.current = snapshot.device.id;
      remoteUserId.current = snapshot.user.id;
      setLinkedDeviceId(snapshot.device.id);
      setLinkedUserId(snapshot.user.id);
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
      const remoteEvents: EventItem[] = snapshot.events.map((event) => ({
        contactId: event.contactId === null ? null : String(event.contactId),
        contactName:
          event.contactId === null
            ? null
            : emergencyContactsRef.current.find(
                (contact) => contact.id === String(event.contactId)
              )?.name ?? null,
        id: `supabase-${event.id}`,
        type: getRemoteEventLabel(event.type),
        description: event.message,
        date: formatRemoteDateTime(event.eventTime),
        eventType: event.type,
        remoteId: event.id,
        severity: event.severity,
      }));

      setProfile(remoteProfile);
      saveProfile(remoteProfile);

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
      const activeAlert = getEffectiveAlertState(
        snapshot.events,
        snapshot.device.reportedAlertState,
        snapshot.device.alertReportedAt
      );

      const nextReadingStatus = getRemoteReadingStatus(remoteReading?.recordedAt ?? null);
      const measurements = readRemoteMeasurements(
        nextReadingStatus === 'Reciente' ? remoteReading : null
      );
      setStatus(getRemoteStatus(snapshot.events, measurements.heartRate, measurements.oxygen, activeAlert));
      setVitals((currentVitals) => ({
        heartRate: measurements.heartRate,
        oxygen: measurements.oxygen,
        // El contrato actual informa impactos, no una clasificacion continua del movimiento.
        movement: activeAlert === 'fall' ? 'Caida' : 'Sin datos',
        trend: getTrend(currentVitals.heartRate, measurements.heartRate),
      }));
      setLastUpdated(remoteReading ? formatRemoteDateTime(remoteReading.recordedAt) : 'Sin lecturas recibidas');
      setBattery(measurements.battery);

      setBackendReachable(true);
      setReadingStatus(nextReadingStatus);
      setSyncError(null);
      void registerRemotePushNotifications(snapshot.device.code);
      void refreshMedications(snapshot.device.code, false, false);
      void refreshEmergencyContactsForUser(snapshot.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al consultar Supabase.';
      setBackendReachable(false);
      setReadingStatus('Sin conexion');
      setSyncError(message);
    } finally {
      remoteRefreshInProgress.current = false;
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

  async function dismissImpactAlert() {
    const deviceId = remoteDeviceId.current;
    if (!deviceId) {
      setDisplayControlMessage('Todavia no se pudo identificar la pulsera vinculada.');
      return false;
    }

    setIsDisplayControlSyncing(true);
    setDisplayControlMessage('Enviando OK para cerrar la alerta en la pulsera...');

    try {
      const commandAt = await sendRemoteOk(deviceId);
      const wasDismissed = await waitForRemoteAlertDismissal(deviceId, commandAt);

      if (!wasDismissed) {
        setDisplayControlMessage(
          'OK enviado, pero BIOSYS todavia no confirmo el cierre de la alerta.'
        );
        return false;
      }

      setStatus('Normal');
      setVitals((currentVitals) => ({ ...currentVitals, movement: 'Reposo' }));
      setDisplayControlMessage('BIOSYS confirmo que la alerta de impacto fue cerrada.');
      addHistoryEvent(
        'Alerta cerrada',
        'La alerta de posible impacto se cerro con OK desde la aplicacion.'
      );
      await refreshRemoteData();
      return true;
    } catch (error) {
      setDisplayControlMessage(
        error instanceof Error ? error.message : 'No se pudo cerrar la alerta remota.'
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

  async function refreshMedications(
    deviceCode = remoteDeviceCode.current,
    force = true,
    showLoading = true
  ) {
    if (!deviceCode) {
      setMedicationSyncMessage('Esperando el codigo de la pulsera para sincronizar.');
      return false;
    }

    if (!force && Date.now() - lastMedicationRefreshAt.current < MEDICATION_REFRESH_MS) {
      return true;
    }

    if (showLoading) setIsMedicationSyncing(true);

    try {
      const remoteMedications = await fetchRemoteMedications(deviceCode);
      setMedications(remoteMedications);
      await saveMedications(remoteMedications);
      lastMedicationRefreshAt.current = Date.now();
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
      if (showLoading) setIsMedicationSyncing(false);
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
    addHistoryEvent('Configuracion', 'Datos del usuario actualizados.');
  }

  async function refreshEmergencyContactsForUser(userId: number, force = false) {
    if (emergencyContactSyncInProgress.current) return false;
    if (
      !force &&
      remoteContactsLoadedForUser.current === userId &&
      Date.now() - lastEmergencyContactRefreshAt.current < EMERGENCY_CONTACT_REFRESH_MS
    ) {
      return true;
    }

    emergencyContactSyncInProgress.current = true;
    setIsContactSyncing(true);
    try {
      const remoteContacts = await fetchRemoteEmergencyContacts(userId);
      emergencyContactsRef.current = remoteContacts;
      setEmergencyContacts(remoteContacts);
      await saveEmergencyContacts(remoteContacts);
      remoteContactsLoadedForUser.current = userId;
      lastEmergencyContactRefreshAt.current = Date.now();
      setEmergencyContactSyncMessage('Contactos y chats de Telegram sincronizados.');
      return true;
    } catch (error) {
      setEmergencyContactSyncMessage(
        `Se usan los contactos guardados en este celular. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    } finally {
      emergencyContactSyncInProgress.current = false;
      setIsContactSyncing(false);
    }
  }

  async function refreshEmergencyContacts(force = true) {
    const userId = remoteUserId.current;
    if (!userId) {
      setEmergencyContactSyncMessage('Esperando la cuenta vinculada para sincronizar.');
      return false;
    }
    return refreshEmergencyContactsForUser(userId, force);
  }

  async function runContactMutation(
    action: (userId: number) => Promise<EmergencyContact[]>,
    successMessage: string
  ) {
    const userId = remoteUserId.current;
    if (!userId) {
      setEmergencyContactSyncMessage('Todavia no se identifico la cuenta VitalWatch.');
      return false;
    }

    setIsContactSyncing(true);
    setEmergencyContactSyncMessage('Cambio pendiente: sincronizando con Supabase...');
    try {
      const remoteContacts = await action(userId);
      emergencyContactsRef.current = remoteContacts;
      setEmergencyContacts(remoteContacts);
      await saveEmergencyContacts(remoteContacts);
      remoteContactsLoadedForUser.current = userId;
      lastEmergencyContactRefreshAt.current = Date.now();
      setEmergencyContactSyncMessage(successMessage);
      return true;
    } catch (error) {
      setEmergencyContactSyncMessage(
        `Error de sincronizacion: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    } finally {
      setIsContactSyncing(false);
    }
  }

  function addPhoneContact(contact: PhoneContactInput) {
    return runContactMutation(
      (userId) => createRemotePhoneContact(userId, contact),
      'Contacto guardado y disponible para sincronizar con la pulsera.'
    );
  }

  function updatePhoneContact(id: string, contact: PhoneContactInput) {
    return runContactMutation(
      (userId) => updateRemotePhoneContact(userId, id, contact),
      'Contacto actualizado en Supabase y en la agenda de la pulsera.'
    );
  }

  function setEmergencyContactActive(id: string, active: boolean) {
    return runContactMutation(
      (userId) => setRemoteContactActive(userId, id, active),
      active ? 'Contacto activado para la pulsera.' : 'Contacto desactivado.'
    );
  }

  function deleteEmergencyContact(id: string) {
    return runContactMutation(
      (userId) => deleteRemoteEmergencyContact(userId, id),
      'Contacto eliminado de VitalWatch.'
    );
  }

  const value = useMemo(
    () => ({
      battery,
      backendReachable,
      displayControl,
      displayControlMessage,
      emergencyContacts,
      emergencyContactSyncMessage,
      history,
      isContactSyncing,
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
      readingStatus,
      status,
      syncError,
      vitals,
      addMedication,
      addPhoneContact,
      deleteEmergencyContact,
      deleteMedication,
      dismissImpactAlert,
      markMedicationTaken,
      markMedicationPending,
      refreshEmergencyContacts,
      refreshMedications,
      refreshRemoteData,
      retryPushNotifications,
      setEmergencyContactActive,
      setDisplayEnabled,
      setDisplayView,
      updateMedication,
      updatePhoneContact,
      updateProfile,
    }),
    [
      battery,
      backendReachable,
      displayControl,
      displayControlMessage,
      emergencyContacts,
      emergencyContactSyncMessage,
      history,
      isContactSyncing,
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
      readingStatus,
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
