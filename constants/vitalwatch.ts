export type WatchStatus =
  | 'Normal'
  | 'Sin lectura'
  | 'Alerta'
  | 'SOS'
  | 'Caida detectada'
  | 'Medicacion pendiente';

export const targetFirmwareVersion = 'BIOSYS 1.0.7';
export const targetSystemVersion = 'SYS 0.9.7';
export const targetBiomedicalVersion = 'BIO 0.6.3';

export type EventItem = {
  id: string;
  type: string;
  description: string;
  date: string;
  contactId?: string | null;
  contactName?: string | null;
  eventType?: string;
  remoteId?: number;
  severity?: string;
};

export type Medication = {
  id: string;
  name: string;
  dose: string;
  date: string;
  time: string;
  // 1 = lunes ... 7 = domingo. Se mantiene opcional para migrar datos antiguos.
  days?: number[];
  // Proxima ocurrencia que debe mostrar la app y la pantalla virtual.
  nextDate?: string;
  status: 'Pendiente' | 'Tomado';
};

export function currentArgentinaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export type UserProfile = {
  elderName: string;
  contactName: string;
  contactInfo: string;
};

export type EmergencyContact = {
  active: boolean;
  channel: 'sms' | 'telegram';
  id: string;
  name: string;
  phoneNumber: string | null;
  telegramChatId: string | null;
  telegramUsername: string | null;
};

export type DeviceDisplayView = 'menu' | 'vitals' | 'movement' | 'status' | 'medication';

export type DeviceAlertState = 'none' | 'fall' | 'sos';

export type DeviceDisplayControl = {
  commandAt: string | null;
  desiredOn: boolean;
  desiredView: DeviceDisplayView;
  reportedAt: string | null;
  reportedOn: boolean | null;
  reportedView: DeviceDisplayView | null;
};

export const deviceDisplayViews: { label: string; value: DeviceDisplayView }[] = [
  { label: 'Menu principal', value: 'menu' },
  { label: 'Signos vitales', value: 'vitals' },
  { label: 'Movimiento', value: 'movement' },
  { label: 'Estado del equipo', value: 'status' },
  { label: 'Medicacion', value: 'medication' },
];

export type VitalTrend = 'sube' | 'baja' | 'estable' | 'sin datos';

export type ReadingStatus =
  | 'Simulada'
  | 'Reciente'
  | 'Demorada'
  | 'Sin comunicacion'
  | 'Sin datos'
  | 'Sin conexion';

export type VitalSigns = {
  heartRate: number | null;
  oxygen: number | null;
  movement: 'Reposo' | 'Leve' | 'Activo' | 'Caida' | 'Sin datos';
  trend: VitalTrend;
};

export const initialProfile: UserProfile = {
  elderName: '',
  contactName: '',
  contactInfo: '',
};

export const initialEmergencyContacts: EmergencyContact[] = [];

export const initialMedications: Medication[] = [];

export const initialDeviceDisplayControl: DeviceDisplayControl = {
  commandAt: null,
  desiredOn: true,
  desiredView: 'menu',
  reportedAt: null,
  reportedOn: null,
  reportedView: null,
};

export const initialHistory: EventItem[] = [];

export const initialVitalSigns: VitalSigns = {
  heartRate: null,
  oxygen: null,
  movement: 'Sin datos',
  trend: 'sin datos',
};

export const statusStyles: Record<
  WatchStatus,
  {
    color: string;
    softColor: string;
    text: string;
    description: string;
  }
> = {
  'Sin lectura': {
    color: '#64748B',
    softColor: '#F1F5F9',
    text: '#334155',
    description: 'Faltan lecturas validas. Revisar el sensor y la ultima actualizacion.',
  },
  Normal: {
    color: '#0E9F6E',
    softColor: '#DCFCE7',
    text: '#064E3B',
    description: 'Sin alertas activas segun los datos disponibles. Lecturas experimentales.',
  },
  Alerta: {
    color: '#F59E0B',
    softColor: '#FEF3C7',
    text: '#78350F',
    description: 'Hay una situacion que necesita revision.',
  },
  SOS: {
    color: '#DC2626',
    softColor: '#FEE2E2',
    text: '#7F1D1D',
    description: 'Emergencia activa. Revisar al usuario inmediatamente.',
  },
  'Caida detectada': {
    color: '#EA580C',
    softColor: '#FFEDD5',
    text: '#7C2D12',
    description: 'Se registro una posible caida. Revisar a la persona.',
  },
  'Medicacion pendiente': {
    color: '#6D28D9',
    softColor: '#EDE9FE',
    text: '#3B0764',
    description: 'Hay un medicamento pendiente de confirmar.',
  },
};

export const appColors = {
  background: '#F6FAFB',
  card: '#FFFFFF',
  text: '#102027',
  muted: '#64748B',
  border: '#E2E8F0',
  primary: '#0A7EA4',
  danger: '#DC2626',
  buttonText: '#FFFFFF',
};
