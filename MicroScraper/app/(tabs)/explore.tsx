import React, { useState } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, Modal, ScrollView, 
  StyleSheet, Switch, StatusBar 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { STORES } from '../../constants';
import versionInfo from '../../version.json';

export default function SettingsScreen() {
  const [isDark, setIsDark] = useState(false);
  const [storeId, setStoreId] = useState('071');
  const [modalVisible, setModalVisible] = useState(false);

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

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Build v{versionInfo.version}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 70 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  label: { fontSize: 18 },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  versionContainer: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  versionText: { fontSize: 12, color: '#999' },
  modalContent: { margin: 20, borderRadius: 10, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  storeOption: { paddingVertical: 15, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
  closeButton: { marginTop: 20, backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
});
