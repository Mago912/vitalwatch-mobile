export type WatchStatus =
  | 'Normal'
  | 'Alerta'
  | 'SOS'
  | 'Caida detectada'
  | 'Medicacion pendiente';

export type EventItem = {
  id: string;
  type: string;
  description: string;
  date: string;
};

export type Medication = {
  id: string;
  name: string;
  time: string;
  status: 'Pendiente' | 'Tomado';
};

export type UserProfile = {
  elderName: string;
  contactName: string;
  contactInfo: string;
};

export const initialProfile: UserProfile = {
  elderName: 'Alicia Gomez',
  contactName: 'Mariana Gomez',
  contactInfo: '+54 9 11 5555-1234',
};

export const initialMedications: Medication[] = [
  {
    id: 'med-1',
    name: 'Losartan 50 mg',
    time: '09:00',
    status: 'Pendiente',
  },
  {
    id: 'med-2',
    name: 'Vitamina D',
    time: '13:00',
    status: 'Pendiente',
  },
];

export const initialHistory: EventItem[] = [
  {
    id: 'event-demo-1',
    type: 'Inicio',
    description: 'VitalWatch listo para simular eventos de la pulsera.',
    date: 'Hoy',
  },
];

export const statusStyles: Record<
  WatchStatus,
  {
    color: string;
    softColor: string;
    text: string;
    description: string;
  }
> = {
  Normal: {
    color: '#0E9F6E',
    softColor: '#DCFCE7',
    text: '#064E3B',
    description: 'La persona esta estable y sin alertas activas.',
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
    description: 'La pulsera simulo una posible caida.',
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
