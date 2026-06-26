import React, { createContext, PropsWithChildren, useEffect, useMemo, useState } from 'react';

import {
  EventItem,
  initialHistory,
  initialMedications,
  initialProfile,
  initialVitalSigns,
  Medication,
  UserProfile,
  VitalSigns,
  WatchStatus,
} from '@/constants/vitalwatch';
import { showLocalNotification, requestNotificationPermissions } from '@/lib/vitalwatch-notifications';
import {
  loadHistory,
  loadMedications,
  loadProfile,
  saveHistory,
  saveMedications,
  saveProfile,
} from '@/lib/vitalwatch-storage';

type VitalWatchContextValue = {
  battery: number;
  history: EventItem[];
  lastUpdated: string;
  medications: Medication[];
  notificationPermission: boolean;
  profile: UserProfile;
  status: WatchStatus;
  vitals: VitalSigns;
  activateFall: () => void;
  activateLowBattery: () => void;
  activateMedicationReminder: () => void;
  activateNormal: () => void;
  activateSos: () => void;
  markMedicationTaken: (id: string) => void;
  updateProfile: (profile: UserProfile) => void;
};

const VitalWatchContext = createContext<VitalWatchContextValue | null>(null);

function formatDateTime() {
  return new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

function decimalBetween(min: number, max: number) {
  return Number((Math.random() * (max - min) + min).toFixed(1));
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
      temperature: decimalBetween(36.9, 37.5),
      systolicPressure: randomBetween(136, 152),
      diastolicPressure: randomBetween(84, 94),
      movement: 'Activo',
    };
  } else if (status === 'Caida detectada') {
    nextVitals = {
      heartRate: randomBetween(92, 112),
      oxygen: randomBetween(93, 97),
      temperature: decimalBetween(36.5, 37.2),
      systolicPressure: randomBetween(128, 145),
      diastolicPressure: randomBetween(80, 90),
      movement: 'Caida',
    };
  } else if (status === 'Alerta') {
    nextVitals = {
      heartRate: randomBetween(82, 98),
      oxygen: randomBetween(94, 98),
      temperature: decimalBetween(36.5, 37.3),
      systolicPressure: randomBetween(124, 140),
      diastolicPressure: randomBetween(78, 88),
      movement: 'Leve',
    };
  } else {
    nextVitals = {
      heartRate: randomBetween(68, 84),
      oxygen: randomBetween(96, 99),
      temperature: decimalBetween(36.2, 37.0),
      systolicPressure: randomBetween(110, 124),
      diastolicPressure: randomBetween(70, 82),
      movement: Math.random() > 0.78 ? 'Leve' : 'Reposo',
    };
  }

  return {
    ...nextVitals,
    trend: getTrend(previousVitals.heartRate, nextVitals.heartRate),
  };
}

export function VitalWatchProvider({ children }: PropsWithChildren) {
  const [battery, setBattery] = useState(86);
  const [history, setHistory] = useState<EventItem[]>(initialHistory);
  const [lastUpdated, setLastUpdated] = useState(formatDateTime());
  const [medications, setMedications] = useState<Medication[]>(initialMedications);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [status, setStatus] = useState<WatchStatus>('Normal');
  const [vitals, setVitals] = useState<VitalSigns>(initialVitalSigns);

  useEffect(() => {
    async function prepareApp() {
      const [savedProfile, savedMedications, savedHistory] = await Promise.all([
        loadProfile(initialProfile),
        loadMedications(initialMedications),
        loadHistory(initialHistory),
      ]);

      setProfile(savedProfile);
      setMedications(savedMedications);
      setHistory(savedHistory);

      const permissionWasGranted = await requestNotificationPermissions();
      setNotificationPermission(permissionWasGranted);
    }

    prepareApp();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      // Esta simulacion reemplaza por ahora a los sensores reales del ESP32.
      setVitals((currentVitals) => simulateVitalSigns(status, currentVitals));
      setLastUpdated(formatDateTime());
    }, 3500);

    return () => clearInterval(intervalId);
  }, [status]);

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

  function markMedicationTaken(id: string) {
    const updatedMedications = medications.map((medication) =>
      medication.id === id ? { ...medication, status: 'Tomado' as const } : medication
    );

    setMedications(updatedMedications);
    saveMedications(updatedMedications);
    addHistoryEvent('Medicacion tomada', 'Medicacion marcada como tomada.');
  }

  function updateProfile(nextProfile: UserProfile) {
    setProfile(nextProfile);
    saveProfile(nextProfile);
    addHistoryEvent('Configuracion', 'Datos de usuario/contacto actualizados.');
  }

  const value = useMemo(
    () => ({
      battery,
      history,
      lastUpdated,
      medications,
      notificationPermission,
      profile,
      status,
      vitals,
      activateFall,
      activateLowBattery,
      activateMedicationReminder,
      activateNormal,
      activateSos,
      markMedicationTaken,
      updateProfile,
    }),
    [battery, history, lastUpdated, medications, notificationPermission, profile, status, vitals]
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
