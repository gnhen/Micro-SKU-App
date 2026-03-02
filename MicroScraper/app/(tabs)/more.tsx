import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useSettings, TabRoute } from '@/contexts/SettingsContext';

// ─── Tab metadata ─────────────────────────────────────────────────────────────

const TAB_META: Record<TabRoute, { label: string; icon: string; route: string }> = {
  index:     { label: 'Scan',       icon: 'scan',          route: '/(tabs)/' },
  list:      { label: 'List',       icon: 'list',          route: '/(tabs)/list' },
  pcbuilder: { label: 'PC Builder', icon: 'hardware-chip', route: '/(tabs)/pcbuilder' },
  history:   { label: 'History',    icon: 'time',          route: '/(tabs)/history' },
  explore:   { label: 'Settings',   icon: 'settings',      route: '/(tabs)/explore' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { overflowTabs } = useSettings();

  const theme = {
    bg: colors.background,
    text: colors.text,
    card: colors.card,
    border: colors.border,
  };

  // Always show Settings first, then overflow tabs in order
  const items: TabRoute[] = [
    'explore',
    ...overflowTabs.filter(t => t !== 'explore'),
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <Text style={[styles.header, { color: theme.text }]}>More</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {items.map(route => {
          const meta = TAB_META[route];
          if (!meta) return null;
          return (
            <TouchableOpacity
              key={route}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(meta.route as any)}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={meta.icon as any} size={26} color="#0173DF" />
              </View>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{meta.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#aaa" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  header:    { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 16 },
  list:      { paddingHorizontal: 20, gap: 12, paddingBottom: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  iconWrap:  { width: 36, alignItems: 'center' },
  rowLabel:  { flex: 1, fontSize: 18, fontWeight: '500' },
});
