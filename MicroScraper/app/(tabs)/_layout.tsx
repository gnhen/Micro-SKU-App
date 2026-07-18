import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
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
          <Label>Scan</Label>
          <Icon sf="barcode.viewfinder" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="list" hidden={!isVisible('list')}>
          <Label>List</Label>
          <Icon sf="list.bullet" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="pcbuilder" hidden={!isVisible('pcbuilder')}>
          <Label>PC Builder</Label>
          <Icon sf="cpu" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="history" hidden={!isVisible('history')}>
          <Label>History</Label>
          <Icon sf="clock" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="explore" hidden={!isVisible('explore')}>
          <Label>Settings</Label>
          <Icon sf="gearshape" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="more" hidden={!showMoreTab}>
          <Label>More</Label>
          <Icon sf="ellipsis" />
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

      {/* Scan — toggleable */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          href: isVisible('index') ? undefined : null,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('index', focused) : <Ionicons name="scan" size={28} color={color} />,
        }}
      />

      {/* List */}
      <Tabs.Screen
        name="list"
        options={{
          title: 'List',
          href: isVisible('list') ? undefined : null,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('list', focused) : <Ionicons name="list" size={28} color={color} />,
        }}
      />

      {/* PC Builder */}
      <Tabs.Screen
        name="pcbuilder"
        options={{
          title: 'PC Builder',
          href: isVisible('pcbuilder') ? undefined : null,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('pcbuilder', focused) : <Ionicons name="hardware-chip" size={28} color={color} />,
        }}
      />

      {/* History */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: isVisible('history') ? undefined : null,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('history', focused) : <Ionicons name="time" size={28} color={color} />,
        }}
      />

      {/* Settings — hidden when More tab is active */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Settings',
          href: isVisible('explore') ? undefined : null,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('explore', focused) : <Ionicons name="settings" size={28} color={color} />,
        }}
      />

      {/* More — visible only when >4 tabs selected */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          href: showMoreTab ? undefined : null,
          tabBarIcon: ({ color, focused }) => isXP ? xpIcon('more', focused) : <Ionicons name="ellipsis-horizontal" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
