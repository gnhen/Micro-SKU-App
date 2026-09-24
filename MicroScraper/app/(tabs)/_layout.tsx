import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors, XP_CHROME, XP_FONT, XP_TAB_EMOJI } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings } from '@/contexts/SettingsContext';

/** In XP mode, tabs get retro emoji icons instead of Ionicons. */
function xpIcon(route: string, focused: boolean) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{XP_TAB_EMOJI[route] ?? '📄'}</Text>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { visibleTabs, showMoreTab } = useSettings();
  const isXP = colorScheme === 'xp';

  const isVisible = (route: string) => visibleTabs.includes(route as any);

  // iOS: native tab bar with Liquid Glass (iOS 26+) / system blur (older iOS).
  // In XP mode the bar becomes a solid taskbar-blue strip instead of glass.
  if (Platform.OS === 'ios') {
    return (
      <NativeTabs
        tintColor={isXP ? XP_CHROME.titleText : Colors[colorScheme ?? 'light'].tint}
        backgroundColor={isXP ? XP_CHROME.taskbarBlue : undefined}
        iconColor={isXP ? XP_CHROME.inactiveTabText : undefined}
        labelStyle={isXP ? { fontFamily: XP_FONT, color: XP_CHROME.inactiveTabText } : undefined}
        disableTransparentOnScrollEdge={isXP ? true : undefined}
      >
        <NativeTabs.Trigger name="index" hidden={!isVisible('index')}>
          <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="barcode.viewfinder" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="list" hidden={!isVisible('list')}>
          <NativeTabs.Trigger.Label>List</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="pcbuilder" hidden={!isVisible('pcbuilder')}>
          <NativeTabs.Trigger.Label>PC Builder</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="cpu" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="history" hidden={!isVisible('history')}>
          <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="clock" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="explore" hidden={!isVisible('explore')}>
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="gearshape" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="more" hidden={!showMoreTab}>
          <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="ellipsis" />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isXP ? XP_CHROME.titleText : Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: isXP ? XP_CHROME.inactiveTabText : undefined,
        tabBarStyle: isXP ? { backgroundColor: XP_CHROME.taskbarBlue, borderTopColor: XP_CHROME.buttonBorder } : undefined,
        tabBarLabelStyle: isXP ? { fontFamily: XP_FONT } : undefined,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>

      {/* All screens keep href: undefined so they stay registered with the router
          and remain navigable from the More screen.  Hidden screens get a tabBarButton
          that renders nothing — the screen stays alive but the tab bar item disappears. */}

      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          href: undefined,
          tabBarButton: isVisible('index') ? undefined : () => null,
          unmountOnBlur: false,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('index', focused) : <Ionicons name="scan" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="list"
        options={{
          title: 'List',
          href: undefined,
          tabBarButton: isVisible('list') ? undefined : () => null,
          unmountOnBlur: false,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('list', focused) : <Ionicons name="list" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="pcbuilder"
        options={{
          title: 'PC Builder',
          href: undefined,
          tabBarButton: isVisible('pcbuilder') ? undefined : () => null,
          unmountOnBlur: false,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('pcbuilder', focused) : <Ionicons name="hardware-chip" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: undefined,
          tabBarButton: isVisible('history') ? undefined : () => null,
          unmountOnBlur: false,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('history', focused) : <Ionicons name="time" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Settings',
          href: undefined,
          tabBarButton: isVisible('explore') ? undefined : () => null,
          unmountOnBlur: false,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('explore', focused) : <Ionicons name="settings" size={28} color={color} />,
        }}
      />

      {/* More is always visible — it's the gateway to overflow / hidden tabs */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          href: undefined,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('more', focused) : <Ionicons name="ellipsis-horizontal" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
