import React, { useState, useEffect, useContext, createContext } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  StyleSheet, Alert, Modal, Switch, Image, StatusBar 
} from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons'; // Built-in with Expo
import { fetchProductBySku } from './services/scraper';
import { STORES } from './constants';

// --- THEME CONTEXT (Light/Dark Mode) ---
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Load saved theme preference
    AsyncStorage.getItem('isDark').then(val => {
      if (val !== null) setIsDark(JSON.parse(val));
    });
  }, []);

  const toggleTheme = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    AsyncStorage.setItem('isDark', JSON.stringify(newVal));
  };

  const theme = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    text: isDark ? '#ffffff' : '#000000',
    card: isDark ? '#333333' : '#f9f9f9',
    border: isDark ? '#444444' : '#eeeeee',
    inputBg: isDark ? '#2a2a2a' : '#ffffff',
    primary: '#007AFF',
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// --- COMPONENTS ---

// 1. SETTINGS SCREEN
function SettingsScreen() {
  const { isDark, toggleTheme, theme } = useContext(ThemeContext);
  const [storeId, setStoreId] = useState('029'); // Default
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('storeId').then(id => { if (id) setStoreId(id); });
  }, []);

  const handleStoreSelect = (id) => {
    setStoreId(id);
    AsyncStorage.setItem('storeId', id);
    setModalVisible(false);
  };

  const currentStoreName = STORES.find(s => s.id === storeId)?.name || "Unknown";

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.header, { color: theme.text }]}>Settings</Text>

      {/* Dark Mode Toggle */}
      <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Dark Mode</Text>
        <Switch value={isDark} onValueChange={toggleTheme} />
      </View>

      {/* Store Selector */}
      <TouchableOpacity 
        style={[styles.settingRow, { borderBottomColor: theme.border }]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.label, { color: theme.text }]}>Store Location</Text>
        <Text style={{ color: theme.primary, fontSize: 16 }}>
          {storeId} - {currentStoreName}
        </Text>
      </TouchableOpacity>

      {/* Store Picker Modal */}
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
                  <Text style={{ color: theme.text, fontSize: 16 }}>{store.name}</Text>
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
    </View>
  );
}

// 2. SCAN SCREEN
function ScanScreen({ route, navigation }) {
  const { theme } = useContext(ThemeContext);
  const [sku, setSku] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Handle "1-tap access" from History tab
  useEffect(() => {
    if (route.params?.preloadSku) {
      setSku(route.params.preloadSku);
      handleSearch(route.params.preloadSku);
      // Clear param so we don't loop
      navigation.setParams({ preloadSku: null });
    }
  }, [route.params?.preloadSku]);

  const addToHistory = async (productData) => {
    try {
      const existing = await AsyncStorage.getItem('scanHistory');
      let history = existing ? JSON.parse(existing) : [];
      
      // Remove duplicates (move to top)
      history = history.filter(item => item.sku !== productData.sku);
      
      // Add new item to front
      history.unshift({
        sku: productData.sku, // Ensure your scraper returns this!
        name: productData.name,
        price: productData.price,
        date: new Date().toISOString()
      });

      // Limit to last 50 items
      if (history.length > 50) history.pop();
      
      await AsyncStorage.setItem('scanHistory', JSON.stringify(history));
    } catch (e) {
      console.error("History Save Error", e);
    }
  };

  const handleSearch = async (searchSku) => {
    const targetSku = searchSku || sku;
    if (!targetSku) return;

    setLoading(true);
    setScanning(false);
    setData(null);
    
    const storeId = await AsyncStorage.getItem('storeId') || '029';
    const result = await fetchProductBySku(targetSku, storeId);
    
    setLoading(false);
    
    if (result.error) {
      Alert.alert("Error", result.error);
    } else {
      // Inject the input SKU into the result object so we can save it to history
      const finalData = { ...result, sku: targetSku };
      setData(finalData);
      addToHistory(finalData);
    }
  };

  const handleBarcodeScanned = ({ data }) => {
    setSku(data);
    setScanning(false);
    handleSearch(data);
  };

  // Camera View
  if (scanning) {
    if (!permission?.granted) {
      return (
        <View style={[styles.container, {backgroundColor: theme.bg, justifyContent: 'center'}]}>
          <Text style={{color: theme.text, textAlign: 'center', marginBottom: 20}}>Camera permission needed</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
             <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <CameraView style={{ flex: 1 }} onBarcodeScanned={handleBarcodeScanned} />
        <TouchableOpacity 
          style={styles.cancelScanBtn} 
          onPress={() => setScanning(false)}
        >
          <Text style={styles.buttonText}>Cancel Scan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Normal View
  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.searchBox}>
        <TextInput 
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} 
          value={sku} 
          onChangeText={setSku} 
          placeholder="Enter SKU" 
          placeholderTextColor="gray"
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.iconButton} onPress={() => setScanning(true)}>
           <Ionicons name="qr-code-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => handleSearch(null)}>
        <Text style={styles.buttonText}>Search Product</Text>
      </TouchableOpacity>

      {loading && <Text style={{marginTop:20, color: theme.text}}>Loading...</Text>}

      {data && (
        <View style={[styles.resultCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Image source={{ uri: data.imageUrl }} style={styles.productImage} />
          <Text style={styles.price}>{data.price}</Text>
          <Text style={[styles.productTitle, { color: theme.text }]}>{data.name}</Text>
          
          <Text style={[styles.sectionHeader, { color: theme.text }]}>Specs:</Text>
          {data.specs.map((spec, i) => (
            <Text key={i} style={{ color: theme.text, marginLeft: 10 }}>• {spec}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// 3. HISTORY SCREEN
function HistoryScreen({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [history, setHistory] = useState([]);

  // Refresh history whenever the tab is focused
  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('scanHistory').then(h => {
        if (h) setHistory(JSON.parse(h));
      });
    }, [])
  );

  const clearHistory = async () => {
    await AsyncStorage.removeItem('scanHistory');
    setHistory([]);
  };

  const handleTapItem = (sku) => {
    // Jump to Scan tab and search
    navigation.navigate('Scan', { preloadSku: sku });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.historyHeader}>
        <Text style={[styles.header, { color: theme.text }]}>Scan History</Text>
        <TouchableOpacity onPress={clearHistory}>
          <Text style={{ color: 'red' }}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {history.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={[styles.historyItem, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => handleTapItem(item.sku)}
          >
            <View>
              <Text style={[styles.historyName, { color: theme.text }]} numberOfLines={1}>
                {item.name || "Unknown Product"}
              </Text>
              <Text style={{ color: 'gray', fontSize: 12 }}>SKU: {item.sku}</Text>
            </View>
            <Text style={[styles.historyPrice, { color: theme.text }]}>{item.price}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// --- MAIN NAVIGATOR ---
const Tab = createBottomTabNavigator();

function MainNavigator() {
  const { theme, isDark } = useContext(ThemeContext);

  return (
    <NavigationContainer>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: 'gray',
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === 'Scan') iconName = 'scan';
            else if (route.name === 'History') iconName = 'time';
            else if (route.name === 'Settings') iconName = 'settings';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Scan" component={ScanScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainNavigator />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  
  // Settings Styles
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  label: { fontSize: 18 },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { margin: 20, borderRadius: 10, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  storeOption: { paddingVertical: 15, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
  closeButton: { marginTop: 20, backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  
  // Scan Styles
  searchBox: { flexDirection: 'row', marginBottom: 15 },
  input: { flex: 1, borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 16 },
  iconButton: { justifyContent: 'center', paddingLeft: 10 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  resultCard: { marginTop: 20, padding: 15, borderWidth: 1, borderRadius: 8 },
  productImage: { width: '100%', height: 200, resizeMode: 'contain' },
  price: { fontSize: 28, fontWeight: 'bold', color: '#C00', marginTop: 10 },
  productTitle: { fontSize: 18, marginVertical: 10, fontWeight: '600' },
  sectionHeader: { fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
  cancelScanBtn: { position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'red', padding: 15, borderRadius: 30 },

  // History Styles
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, marginBottom: 10, borderWidth: 1, borderRadius: 8 },
  historyName: { fontWeight: 'bold', width: 200 },
  historyPrice: { fontWeight: 'bold', color: '#C00' },
});