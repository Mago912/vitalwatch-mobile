import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';

const PENDING_NOTIFICATION_ROUTE_KEY = 'vitalwatch:pending-notification-route';
const EVENT_ROUTE_PATTERN = /^\/event\/(\d+)$/;

// VW-NOTIF-02 — Solo se aceptan rutas de detalle con ID numerico. De este modo
// una push manipulada no puede redirigir a pantallas arbitrarias de la app.
export function getEventRouteFromNotification(notification: Notifications.Notification) {
  const data = notification.request.content.data;
  const explicitRoute = typeof data?.url === 'string' ? data.url : null;
  if (explicitRoute && EVENT_ROUTE_PATTERN.test(explicitRoute)) return explicitRoute;

  const rawEventId = data?.event_id ?? data?.eventId;
  const eventId = typeof rawEventId === 'number' ? rawEventId : Number(rawEventId);
  return Number.isInteger(eventId) && eventId > 0 ? `/event/${eventId}` : null;
}

export async function savePendingNotificationRoute(route: string) {
  if (!EVENT_ROUTE_PATTERN.test(route)) return;
  await AsyncStorage.setItem(PENDING_NOTIFICATION_ROUTE_KEY, route);
}

export async function consumePendingNotificationRoute() {
  const route = await AsyncStorage.getItem(PENDING_NOTIFICATION_ROUTE_KEY);
  if (!route || !EVENT_ROUTE_PATTERN.test(route)) return null;

  await AsyncStorage.removeItem(PENDING_NOTIFICATION_ROUTE_KEY);
  return route;
}
