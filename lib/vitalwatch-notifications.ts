import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PUSH_TOKEN_TIMEOUT_MS = 15000;

type PushRegistrationProgress = (message: string) => void;

// Hace que las notificaciones tambien se vean cuando la app esta abierta.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('vitalwatch-alerts', {
      name: 'Alertas VitalWatch',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC2626',
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.status === 'granted') {
    return true;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();
  return requestedPermission.status === 'granted';
}

export async function showLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: null,
    });
  } catch {
    // Si el usuario rechazo permisos, la app igual debe seguir funcionando.
  }
}

export async function getExpoPushToken(onProgress?: PushRegistrationProgress) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error('Las notificaciones push remotas no estan disponibles en esta plataforma.');
  }

  onProgress?.('Comprobando el permiso de notificaciones del celular.');
  const permissionWasGranted = await requestNotificationPermissions();

  if (!permissionWasGranted) {
    throw new Error(
      'El permiso esta desactivado. Abri los permisos de Android y habilita Notificaciones.'
    );
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error('No se encontro el projectId de EAS en app.json.');
  }

  // Primero comprobamos FCM para poder mostrar con claridad si falla Firebase.
  onProgress?.('Permiso concedido. Solicitando el token FCM de Android.');

  try {
    await withTimeout(
      Notifications.getDevicePushTokenAsync(),
      'FCM no respondio en 15 segundos. Revisa Internet y Google Play Services.'
    );
  } catch (error) {
    throw new Error(`No se pudo obtener el token FCM: ${getErrorMessage(error)}`);
  }

  onProgress?.('Token FCM obtenido. Solicitando el token de Expo.');

  try {
    const expoToken = await withTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      'Expo no respondio en 15 segundos. Revisa la conexion a Internet.'
    );

    return expoToken.data;
  } catch (error) {
    throw new Error(`No se pudo obtener el token de Expo: ${getErrorMessage(error)}`);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), PUSH_TOKEN_TIMEOUT_MS);

    promise.then(resolve, reject).finally(() => clearTimeout(timeoutId));
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
