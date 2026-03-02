import React, { useState } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, Modal, ScrollView, 
  StyleSheet, Switch, StatusBar, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { STORES } from '../../constants';
import versionInfo from '../../version.json';
import { checkForUpdates } from '../../services/updateChecker';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import {
  useSettings,
  DEPARTMENTS,
  OPTIONAL_TABS,
  DEPARTMENT_DEFAULTS,
  TabRoute,
  Department,
} from '@/contexts/SettingsContext';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [storeId, setStoreId] = useState('071');
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [deptModalVisible, setDeptModalVisible] = useState(false);

  const { department, selectedTabs, setDepartment, setSelectedTabs, showMoreTab } = useSettings();

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('storeId').then(id => { 
        if (id) setStoreId(id); 
      });
    }, [])
  );

  const theme = {
    bg: colors.background,
    text: colors.text,
    card: colors.card,
    border: colors.border,
  };

  const handleStoreSelect = (id: string) => {
    setStoreId(id);
    AsyncStorage.setItem('storeId', id);
    setStoreModalVisible(false);
  };

  const currentStoreName = STORES.find((s: any) => s.id === storeId)?.name || 'Unknown';

  // ── Tab toggle ──────────────────────────────────────────────────────────────
  const toggleTab = (route: TabRoute) => {
    const isOn = selectedTabs.includes(route);
    let next: TabRoute[];
    if (isOn) {
      // Must keep at least 1 tab besides Settings (explore is always on)
      const otherSelected = selectedTabs.filter(t => t !== 'explore');
      if (otherSelected.length <= 1) return;
      next = selectedTabs.filter(t => t !== route);
    } else {
      next = [...selectedTabs, route];
    }
    setSelectedTabs(next);
  };

  // Count of tabs that will actually be in bar vs More
  const totalSelected = selectedTabs.length;
  const willUseMore = totalSelected > 4;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.header, { color: theme.text }]}>Settings</Text>

        {/* ── Department ── */}
        <Text style={[styles.sectionLabel, { color: '#aaa' }]}>DEPARTMENT</Text>
        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
          onPress={() => setDeptModalVisible(true)}
        >
          <Text style={[styles.label, { color: theme.text }]}>Department</Text>
          <View style={styles.rowRight}>
            <Text style={{ color: '#0173DF', fontSize: 15 }}>{department}</Text>
            <Ionicons name="chevron-forward" size={16} color="#aaa" />
          </View>
        </TouchableOpacity>

        {/* ── Tab Customization ── */}
        <Text style={[styles.sectionLabel, { color: '#aaa', marginTop: 20 }]}>VISIBLE TABS</Text>
        {willUseMore && (
          <View style={[styles.infoBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={18} color="#0173DF" />
            <Text style={{ color: theme.text, flex: 1, fontSize: 13 }}>
              More than 4 tabs selected — Settings will move to the "More" tab.
            </Text>
          </View>
        )}

        {/* Scan / optional tabs */}
        {OPTIONAL_TABS.map(({ route, label }) => {
          const iconNames: Record<TabRoute, string> = {
            index:     'scan',
            list:      'list',
            pcbuilder: 'hardware-chip',
            history:   'time',
            explore:   'settings',
          };
          const isOn = selectedTabs.includes(route);
          // Can turn off as long as at least 1 non-Settings tab remains
          const otherSelected = selectedTabs.filter(t => t !== 'explore');
          const canRemove = !(isOn && otherSelected.length <= 1);
          return (
            <View
              key={route}
              style={[styles.settingRow, { borderBottomColor: theme.border }]}
            >
              <View style={styles.tabRowLeft}>
                <Ionicons name={iconNames[route] as any} size={20} color="#aaa" style={styles.tabIcon} />
                <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
              </View>
              <Switch
                value={isOn}
                onValueChange={() => canRemove && toggleTab(route)}
                thumbColor="#fff"
                trackColor={{ true: '#0173DF', false: '#ccc' }}
                disabled={!canRemove}
              />
            </View>
          );
        })}

        {/* Settings — always on, cannot be removed */}
        <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
          <View style={styles.tabRowLeft}>
            <Ionicons name="settings" size={20} color="#aaa" style={styles.tabIcon} />
            <Text style={[styles.label, { color: theme.text }]}>Settings</Text>
          </View>
          <Switch value={true} disabled thumbColor="#fff" trackColor={{ true: '#0173DF' }} />
        </View>

        {/* ── Store ── */}
        <Text style={[styles.sectionLabel, { color: '#aaa', marginTop: 20 }]}>GENERAL</Text>
        <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.text }]}>Theme</Text>
          <Text style={{ color: theme.text, fontSize: 16 }}>System ({colorScheme === 'dark' ? 'Dark' : 'Light'})</Text>
        </View>

        <TouchableOpacity 
          style={[styles.settingRow, { borderBottomColor: theme.border }]} 
          onPress={() => setStoreModalVisible(true)}
        >
          <Text style={[styles.label, { color: theme.text }]}>Store Location</Text>
          <View style={styles.rowRight}>
            <Text style={{ color: '#0173DF', fontSize: 15 }}>
              {storeId} - {currentStoreName}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#aaa" />
          </View>
        </TouchableOpacity>

        {(Platform.OS === 'android' || Platform.OS === 'ios') && (
          <TouchableOpacity 
            style={[styles.settingRow, { borderBottomColor: theme.border }]} 
            onPress={checkForUpdates}
          >
            <Text style={[styles.label, { color: theme.text }]}>Check for Updates</Text>
            <Text style={{ color: '#0173DF', fontSize: 16 }}>v{versionInfo.version}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
        <Text style={styles.versionText}>Build v{versionInfo.version}</Text>
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Department picker ── */}
      <Modal visible={deptModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Department</Text>
            <ScrollView>
              {DEPARTMENTS.map(dept => (
                <TouchableOpacity
                  key={dept}
                  style={[styles.storeOption, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    setDeptModalVisible(false);
                    setDepartment(dept);
                  }}
                >
                  <Text style={{ fontSize: 16, color: theme.text }}>{dept}</Text>
                  {dept === department && (
                    <Ionicons name="checkmark" size={18} color="#0173DF" />
                  )}
                  <Text style={{ color: '#aaa', fontSize: 12 }}>
                    {DEPARTMENT_DEFAULTS[dept].filter(t => t !== 'index').map(t =>
                      OPTIONAL_TABS.find(o => o.route === t)?.label
                    ).filter(Boolean).join(', ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setDeptModalVisible(false)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Store picker ── */}
      <Modal visible={storeModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Store</Text>
            <ScrollView>
              {STORES.map((store: any) => (
                <TouchableOpacity 
                  key={store.id} 
                  style={[styles.storeOption, { borderBottomColor: theme.border }]}
                  onPress={() => handleStoreSelect(store.id)}
                >
                  <Text style={{ fontSize: 16, color: theme.text }}>{store.name}</Text>
                  <Text style={{ color: 'gray' }}>{store.id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setStoreModalVisible(false)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollContent:{ padding: 20, paddingTop: 70 },
  header:       { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4, marginTop: 4 },
  settingRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  tabRowLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabIcon:      { width: 22 },
  label:        { fontSize: 18 },
  rowRight:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  versionText:  { fontSize: 12, color: '#999', textAlign: 'center' },
  modalContainer:{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { margin: 20, borderRadius: 10, padding: 20, maxHeight: '80%' },
  modalTitle:   { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  storeOption:  { paddingVertical: 15, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  closeButton:  { marginTop: 20, backgroundColor: '#0173DF', padding: 15, borderRadius: 10, alignItems: 'center' },
});
