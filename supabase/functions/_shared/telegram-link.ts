export type LinkedDeviceStatus = {
  connection_status: 'online' | 'offline' | 'unknown';
  last_seen_at: string | null;
};

export function parseTelegramLinkCode(text: string) {
  const match = text
    .trim()
    .match(/^\/(?:start|vincular)(?:@[A-Za-z0-9_]+)?\s+([A-Z0-9]{8})$/i);

  return match?.[1].toUpperCase() ?? null;
}

export function formatLinkedDeviceStatus(device: LinkedDeviceStatus | null) {
  if (!device) return 'Todavia no hay una pulsera vinculada a esta cuenta.';

  const labels = {
    online: 'CONECTADA',
    offline: 'SIN COMUNICACION',
    unknown: 'SIN ESTADO TODAVIA',
  } as const;
  const lastSeen = device.last_seen_at
    ? new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date(device.last_seen_at))
    : 'sin datos';
  return `Pulsera VitalWatch: ${labels[device.connection_status]}.\nUltima comunicacion: ${lastSeen}.`;
}
