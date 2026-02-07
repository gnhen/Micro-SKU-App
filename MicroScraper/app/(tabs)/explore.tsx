import React, { useState } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, Modal, ScrollView, 
  StyleSheet, Switch, StatusBar 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { STORES } from '../../constants';

export default function SettingsScreen() {
  const [isDark, setIsDark] = useState(false);
  const [storeId, setStoreId] = useState('071');
  const [modalVisible, setModalVisible] = useState(false);
  const [shortcutsModalVisible, setShortcutsModalVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('isDark').then(val => {
        if (val !== null) setIsDark(JSON.parse(val));
      });
      AsyncStorage.getItem('storeId').then(id => { 
        if (id) setStoreId(id); 
      });
    }, [])
  );

  const theme = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    text: isDark ? '#ffffff' : '#000000',
    card: isDark ? '#333333' : '#f9f9f9',
    border: isDark ? '#444444' : '#eeeeee',
  };

  const toggleTheme = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    AsyncStorage.setItem('isDark', JSON.stringify(newVal));
  };

  const handleStoreSelect = (id) => {
    setStoreId(id);
    AsyncStorage.setItem('storeId', id);
    setModalVisible(false);
  };

  const currentStoreName = STORES.find(s => s.id === storeId)?.name || "Unknown";

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Text style={[styles.header, { color: theme.text }]}>Settings</Text>

      <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Dark Mode</Text>
        <Switch value={isDark} onValueChange={toggleTheme} />
      </View>

      <TouchableOpacity 
        style={[styles.settingRow, { borderBottomColor: theme.border }]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.label, { color: theme.text }]}>Store Location</Text>
        <Text style={{ color: '#007AFF', fontSize: 16 }}>
          {storeId} - {currentStoreName}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.settingRow, { borderBottomColor: theme.border }]} 
        onPress={() => setShortcutsModalVisible(true)}
      >
        <Text style={[styles.label, { color: theme.text }]}>iOS Shortcuts</Text>
        <Text style={{ color: '#007AFF', fontSize: 16 }}>Setup Guide</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Store</Text>
            <ScrollView>
              {STORES.map((store) => (
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
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shortcuts Help Modal */}
      <Modal visible={shortcutsModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>iOS Shortcuts Setup</Text>
            <ScrollView>
              <Text style={[styles.shortcutHeader, { color: theme.text }]}>1. Search by SKU</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Open Shortcuts app</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Tap + to create new shortcut</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Add "Ask for Input" action (Number)</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Add "Open URLs" action</Text>
              <Text style={[styles.shortcutUrl, { color: '#007AFF' }]}>URL: microscraper://search?sku=</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Tap after "sku=" and select "Input"</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Name it "Search Micro Center"</Text>
              
              <Text style={[styles.shortcutHeader, { color: theme.text, marginTop: 20 }]}>2. Open Scanner</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Open Shortcuts app</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Tap + to create new shortcut</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Add "Open URLs" action</Text>
              <Text style={[styles.shortcutUrl, { color: '#007AFF' }]}>URL: microscraper://scan</Text>
              <Text style={[styles.shortcutStep, { color: theme.text }]}>• Name it "Scan Micro Center"</Text>
              
              <Text style={[styles.shortcutNote, { color: theme.text, marginTop: 20 }]}>💡 Tip: Use "Hey Siri, [Shortcut Name]" for voice control!</Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShortcutsModalVisible(false)}
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
  container: { flex: 1, padding: 20, paddingTop: 70 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  label: { fontSize: 18 },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { margin: 20, borderRadius: 10, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  storeOption: { paddingVertical: 15, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
  closeButton: { marginTop: 20, backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  shortcutHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  shortcutStep: { fontSize: 14, marginBottom: 6, marginLeft: 10 },
  shortcutUrl: { fontSize: 13, marginLeft: 20, marginTop: 4, marginBottom: 8, fontFamily: 'monospace' },
  shortcutNote: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
});
