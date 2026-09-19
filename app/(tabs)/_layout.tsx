import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { VitalWatchProvider } from '@/providers/vitalwatch-provider';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <VitalWatchProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="medication"
        options={{
          title: 'Medicacion',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="pills.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="watch"
        options={{
          title: 'Pulsera',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="applewatch" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Config',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
      {/* VW-APP-03 — Rutas internas: no agregan botones a la barra existente. */}
      <Tabs.Screen name="contacts" options={{ href: null }} />
      <Tabs.Screen name="event/[eventId]" options={{ href: null }} />
    </Tabs>
    </VitalWatchProvider>
  );
}
