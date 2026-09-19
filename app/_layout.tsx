import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Href, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  consumePendingNotificationRoute,
  getEventRouteFromNotification,
  savePendingNotificationRoute,
} from '@/lib/vitalwatch-notification-routing';

export const unstable_settings = {
  anchor: 'sign-in',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { isLinked, isLoading, session } = useAuth();
  const router = useRouter();
  const accessReadyRef = useRef(false);
  const handledNotificationIdRef = useRef<string | null>(null);

  accessReadyRef.current = Boolean(session && isLinked);

  // VW-NOTIF-03 — Un toque abre el evento exacto. Si primero hace falta login
  // o vincular la pulsera, la ruta queda pendiente y se consume al autorizarse.
  useEffect(() => {
    async function redirect(notification: Notifications.Notification) {
      const notificationId = notification.request.identifier;
      if (handledNotificationIdRef.current === notificationId) return;

      const route = getEventRouteFromNotification(notification);
      if (!route) return;
      handledNotificationIdRef.current = notificationId;

      if (accessReadyRef.current) router.push(route as Href);
      else await savePendingNotificationRoute(route);
    }

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) void redirect(lastResponse.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void redirect(response.notification);
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!session || !isLinked || isLoading) return;

    void consumePendingNotificationRoute().then((route) => {
      if (route) router.push(route as Href);
    });
  }, [isLinked, isLoading, router, session]);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#0A7EA4" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(session && isLinked)}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session && !isLinked)}>
        <Stack.Screen name="pair-device" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#F6FAFB',
    flex: 1,
    justifyContent: 'center',
  },
});
