import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings } from '@/contexts/SettingsContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { visibleTabs, showMoreTab } = useSettings();

  const isVisible = (route: string) => visibleTabs.includes(route as any);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>

      {/* Scan — toggleable */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          href: isVisible('index') ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="scan" size={28} color={color} />,
        }}
      />

      {/* List */}
      <Tabs.Screen
        name="list"
        options={{
          title: 'List',
          href: isVisible('list') ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="list" size={28} color={color} />,
        }}
      />

      {/* PC Builder */}
      <Tabs.Screen
        name="pcbuilder"
        options={{
          title: 'PC Builder',
          href: isVisible('pcbuilder') ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="hardware-chip" size={28} color={color} />,
        }}
      />

      {/* History */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: isVisible('history') ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="time" size={28} color={color} />,
        }}
      />

      {/* Settings — hidden when More tab is active */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Settings',
          href: isVisible('explore') ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={28} color={color} />,
        }}
      />

      {/* More — visible only when >4 tabs selected */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          href: showMoreTab ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="ellipsis-horizontal" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
