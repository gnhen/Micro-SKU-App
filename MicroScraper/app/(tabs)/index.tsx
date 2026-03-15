import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  StyleSheet, Alert, Image, Modal, Dimensions, PixelRatio, StatusBar, Linking, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { fetchProductBySku, fetchTextSearch } from '../../services/scraper';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { initDatabase, addComponent } from '@/services/database';
import { detectComponentCategory, extractComponentSpecs } from '@/services/componentDetector';
import { useSettings } from '@/contexts/SettingsContext';
import { lookupUiCare } from '@/constants/uiCareData';
import { lookupStore071MergedCode, lookupStore071MergedCodes } from '@/constants/store071Lookup';
import { findStore071MapEntries, STORE_071_MAP_IMAGE, STORE_071_MAP_IMAGE_WIDTH, STORE_071_MAP_IMAGE_HEIGHT, STORE_071_MAP_PAGE_HEIGHT, STORE_071_MAP_PAGE_WIDTH } from '@/constants/store071MapIndex';
import type { Store071MapEntry } from '@/constants/store071MapIndex';
import PlansModal from '@/components/PlansModal';
import type { ItemList, ListItem } from './list';

const LIST_STORAGE_KEY = 'itemLists';

// Helper function to process scanned barcode data
const processBarcodeData = (scannedData) => {
  // Aggressively clean invisible characters which might mess up regex/length checks
  const trimmedData = scannedData.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
  const charCount = trimmedData.length;
  
  console.log(`Processing barcode: "${trimmedData}" (Length: ${charCount})`);

  // 1. URL Check
  if (trimmedData.toLowerCase().includes('microcenter.com')) {
    console.log('Detected Micro Center URL');
    return { value: trimmedData, isURL: true };
  }
  
  // 2. Exact 6 digits Check (Direct SKU)
  if (/^\d{6}$/.test(trimmedData)) {
    console.log('Detected 6-digit SKU');
    return trimmedData;
  }
  
  // 3. Special Internal Code (7-10 characters)
  // Examples: "75007500df", "75007583df"
  // Logic: If it starts with 6 digits and is within this length range, pull the SKU.
  if (charCount >= 7 && charCount <= 10) {
    const startsWithSixDigits = /^\d{6}/.test(trimmedData);
    if (startsWithSixDigits) {
      const extractedSku = trimmedData.substring(0, 6);
      console.log(`Extracted SKU from internal code: ${extractedSku}`);
      return extractedSku;
    }
  }
  
  // 4. UPC / Long Code Check ( > 10 characters )
  // Example: "824142287309"
  if (charCount > 10) {
    console.log('Detected UPC code (>10 chars)');
    return { value: trimmedData, isUPC: true };
  }
  
  // Fallback
  console.log('Using fallback - returning trimmed data as-is');
  return trimmedData;
};

export default function ScanScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [sku, setSku] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [storeId, setStoreId] = useState('071');
  const [expandedSpecs, setExpandedSpecs] = useState(true);
  const [fullScreenImage, setFullScreenImage] = useState<string | number | null>(null);
  const [mapOverlayNotice, setMapOverlayNotice] = useState<string | null>(null);
  const [validImageUrls, setValidImageUrls] = useState([]);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [addingToBuilder, setAddingToBuilder] = useState(false);
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [addingToList, setAddingToList] = useState(false);
  const [showListPickerModal, setShowListPickerModal] = useState(false);
  const [pendingListItem, setPendingListItem] = useState<ListItem | null>(null);
  const [availableListsForPicker, setAvailableListsForPicker] = useState<ItemList[]>([]);

  const mismatchAlertActive = useRef(false);
  const noResultsAlertActive = useRef(false);
    const mapMinScaleRef = useRef(1);

  // Text search mode
  const [textSearchMode, setTextSearchMode] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const [textResults, setTextResults] = useState<{sku: string, name: string, price: string | null, url: string, imageUrl: string | null, stockText: string | null}[]>([]);
  const [textSearchLoading, setTextSearchLoading] = useState(false);
  const [store071MergedCode, setStore071MergedCode] = useState<string | null>(null);
  const [store071MergedCodes, setStore071MergedCodes] = useState<string[]>([]);
  const [mapMatches, setMapMatches] = useState<Store071MapEntry[]>([]);
  const [mapMatchIndex, setMapMatchIndex] = useState(0);
  const [mapSearchCode, setMapSearchCode] = useState<string | null>(null);

  const { selectedTabs, plansEnabled, department } = useSettings();
  const listTabActive = selectedTabs.includes('list');

  const [plansModalVisible, setPlansModalVisible] = useState(false);
  
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const _pr = PixelRatio.get();
  const MAP_LOGICAL_W = STORE_071_MAP_IMAGE_WIDTH / _pr;
  const MAP_LOGICAL_H = STORE_071_MAP_IMAGE_HEIGHT / _pr;

  const resetImageTransform = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    mapMinScaleRef.current = 1;
  };

  const onPinchGesture = (event) => {
    scale.value = savedScale.value * event.nativeEvent.scale;
  };

  const onPinchEnd = (event) => {
    savedScale.value = scale.value;
      const minScale = fullScreenImage === STORE_071_MAP_IMAGE ? mapMinScaleRef.current : 1;
      if (scale.value < minScale) {
        scale.value = withSpring(minScale);
        savedScale.value = minScale;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  };

  const onPanGesture = (event) => {
    translateX.value = savedTranslateX.value + event.nativeEvent.translationX;
    translateY.value = savedTranslateY.value + event.nativeEvent.translationY;
  };

  const onPanEnd = () => {
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
  };

  const focusMapEntry = (entry: Store071MapEntry) => {
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const displayFitScale = Math.min(screenWidth / MAP_LOGICAL_W, screenHeight / MAP_LOGICAL_H);
    mapMinScaleRef.current = displayFitScale;

    const avgX = (entry.xMin + entry.xMax) / 2;
    const avgY = (entry.yMin + entry.yMax) / 2;

    const matchImgW = Math.max(
      MAP_LOGICAL_W * (entry.xMax - entry.xMin) / STORE_071_MAP_PAGE_WIDTH,
      MAP_LOGICAL_W * 0.005,
    );
    const matchImgH = Math.max(
      MAP_LOGICAL_H * (entry.yMax - entry.yMin) / STORE_071_MAP_PAGE_HEIGHT,
      MAP_LOGICAL_H * 0.005,
    );

    const targetZoomX = (screenWidth * 0.35) / (matchImgW * displayFitScale);
    const targetZoomY = (screenHeight * 0.35) / (matchImgH * displayFitScale);
    const targetZoom = Math.max(1.8, Math.min(4.5, Math.min(targetZoomX, targetZoomY)));
    const targetScale = displayFitScale * targetZoom;

    scale.value = targetScale;
    savedScale.value = targetScale;

    const targetTranslateX = MAP_LOGICAL_W * (0.5 - avgX / STORE_071_MAP_PAGE_WIDTH) * targetScale;
    const targetTranslateY = MAP_LOGICAL_H * (0.5 - avgY / STORE_071_MAP_PAGE_HEIGHT) * targetScale;

    translateX.value = targetTranslateX;
    translateY.value = targetTranslateY;
    savedTranslateX.value = targetTranslateX;
    savedTranslateY.value = targetTranslateY;
  };

  const focusMapMatchAtIndex = (nextIndex: number) => {
    if (mapMatches.length === 0) return;
    const wrapped = (nextIndex + mapMatches.length) % mapMatches.length;
    setMapMatchIndex(wrapped);
    focusMapEntry(mapMatches[wrapped]);
    setMapOverlayNotice(null);
  };

  const handlePrevMapMatch = () => focusMapMatchAtIndex(mapMatchIndex - 1);
  const handleNextMapMatch = () => focusMapMatchAtIndex(mapMatchIndex + 1);

  const openStoreMapForCodes = (locationCodes: string[]) => {
    resetImageTransform();

    const codes = Array.from(new Set(
      locationCodes
        .map(code => String(code ?? '').trim())
        .filter(code => code.length > 0)
    ));

    const seen = new Set<string>();
    const matches: Store071MapEntry[] = [];

    for (const code of codes) {
      const codeMatches = findStore071MapEntries(code);
      for (const entry of codeMatches) {
        const key = `${entry.text}|${entry.xMin}|${entry.yMin}|${entry.xMax}|${entry.yMax}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push(entry);
      }
    }

    setMapSearchCode(codes[0] ?? null);
    setMapMatches(matches);
    setMapMatchIndex(0);

    if (matches.length > 0) {
      focusMapEntry(matches[0]);
      setMapOverlayNotice(null);
    } else {
      const fallbackCode = codes[0] ?? null;
      setMapOverlayNotice(fallbackCode ? `Location ${fallbackCode} not found on map` : 'No location available');
    }

    setFullScreenImage(STORE_071_MAP_IMAGE);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ],
    };
  });

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('storeId').then(id => {
        if (id) setStoreId(id);
      });
      // Check for pending search from history
      AsyncStorage.getItem('pendingSearch').then(async (pendingSku) => {
        if (pendingSku) {
          // Clear the pending search
          await AsyncStorage.removeItem('pendingSearch');
          // Exit text search mode so the result card is visible
          setTextSearchMode(false);
          setTextResults([]);
          setTextQuery('');
          // Set the SKU and trigger search
          setSku(pendingSku);
          handleSearch(pendingSku);
        }
      });
    }, [])
  );

  // Handle deep links for iOS Shortcuts
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);
      
      // microscraper://search?sku=123456
      if (url.includes('search')) {
        const skuMatch = url.match(/sku=([0-9]+)/);
        if (skuMatch && skuMatch[1]) {
          const skuValue = skuMatch[1];
          setSku(skuValue);
          handleSearch(skuValue);
        }
      }
      // microscraper://scan
      else if (url.includes('scan')) {
        setScanning(true);
      }
    };

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for URL events while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  // Reset scan lock when starting a new scan session
  useEffect(() => {
    if (scanning) {
      setScannerEnabled(true);
    }
  }, [scanning]);

  const theme = {
    bg: colors.background,
    text: colors.text,
    card: colors.card,
    border: colors.border,
    inputBg: colors.background,
    primary: colors.tint,
  };

  const addToHistory = async (productData) => {
    try {
      const existing = await AsyncStorage.getItem('searchHistory');
      let history = existing ? JSON.parse(existing) : [];
      
      history = history.filter(item => item.sku !== productData.sku);
      
      history.unshift({
        sku: productData.sku,
        name: productData.name,
        price: productData.price,
        date: new Date().toISOString()
      });

      if (history.length > 50) history.pop();
      
      await AsyncStorage.setItem('searchHistory', JSON.stringify(history));
    } catch (e) {
      console.error("History Save Error", e);
    }
  };

  const handleAddToPCBuilder = async () => {
    if (!data) return;

    try {
      setAddingToBuilder(true);

      // Initialize database
      await initDatabase();

      // Detect component category
      const specsArray = data.specs || [];
      const category = detectComponentCategory(data.name, specsArray);

      if (!category) {
        Alert.alert(
          'Not a PC Component',
          'This product doesn\'t appear to be a PC component. Only CPUs, GPUs, RAM, motherboards, storage, PSUs, cases, and coolers can be added to PC Builder.',
          [{ text: 'OK' }]
        );
        return;
      }

      setDetectedCategory(category);

      // Extract specs for this category
      const extractedSpecs = extractComponentSpecs(category, specsArray, data.name);

      // Determine price
      const price = data.sale_price || 
                   (data.price ? parseFloat(data.price.replace(/[$,]/g, '')) : null);
      const salePrice = data.sale_price && data.price !== data.sale_price ? 
                       parseFloat(data.sale_price.replace(/[$,]/g, '')) : null;

      // Add component to database
      const componentData = {
        sku: data.sku || sku,
        name: data.name,
        category,
        brand: data.brand || null,
        price: price,
        sale_price: salePrice,
        image_url: validImageUrls?.[0] || data.imageUrl || null,
        url: data.url || null,
        specs: extractedSpecs,
      };

      await addComponent(componentData);

      // Show success with category info
      const categoryNames = {
        cpu: 'CPU',
        motherboard: 'Motherboard',
        ram: 'RAM',
        gpu: 'Graphics Card',
        storage: 'Storage',
        psu: 'Power Supply',
        case: 'Case',
        cooler: 'CPU Cooler',
        case_fans: 'Case Fans',
        os: 'Operating System',
      };

      Alert.alert(
        'Added to PC Builder!',
        `${data.name}\n\nCategory: ${categoryNames[category] || category}\n\nYou can now find this component in the PC Builder tab.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error adding to PC Builder:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to add component to PC Builder. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setAddingToBuilder(false);
      setDetectedCategory(null);
    }
  };

  const handleAddToList = async () => {
    if (!data) return;
    setAddingToList(true);
    try {
      const raw = await AsyncStorage.getItem(LIST_STORAGE_KEY);
      const lists: ItemList[] = raw ? JSON.parse(raw) : [];

      if (lists.length === 0) {
        Alert.alert(
          'No Lists',
          'Create a list in the List tab first.',
          [{ text: 'OK' }]
        );
        return;
      }

      const priceNum = (() => {
        const p = data.sale_price || data.price;
        if (!p) return null;
        const n = parseFloat(p.replace(/[^0-9.]/g, ''));
        return isNaN(n) ? null : n;
      })();

      const newItem: ListItem = {
        id: Date.now().toString(),
        sku: data.sku || sku,
        name: data.name || sku,
        price: priceNum,
        rawPrice: data.sale_price || data.price || '—',
        storeId: storeId,
        date: new Date().toISOString(),
        stockText: data.stockText ?? null,
        inStock: data.inStock ?? null,
      };

      const addToListById = async (listId: string) => {
        const latestRaw = await AsyncStorage.getItem(LIST_STORAGE_KEY);
        const latestLists: ItemList[] = latestRaw ? JSON.parse(latestRaw) : lists;
        const updated = latestLists.map(l =>
          l.id === listId ? { ...l, items: [...l.items, newItem] } : l
        );
        await AsyncStorage.setItem(LIST_STORAGE_KEY, JSON.stringify(updated));
        Alert.alert('Added!', `"${newItem.name}" added to "${latestLists.find(l => l.id === listId)?.name}".`);
        setShowListPickerModal(false);
        setPendingListItem(null);
      };

      if (lists.length === 1) {
        await addToListById(lists[0].id);
      } else {
        // Show scrollable modal picker
        setPendingListItem(newItem);
        setAvailableListsForPicker(lists);
        setShowListPickerModal(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add to list.');
    } finally {
      setAddingToList(false);
    }
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return;
    setTextSearchLoading(true);
    setTextResults([]);
    setData(null);
    setError(null);
    try {
      const sid = await AsyncStorage.getItem('storeId') || '071';
      const result = await fetchTextSearch(textQuery.trim(), sid);
      if (result.singleUrl) {
        // Only one product matched — load it directly and exit text mode
        setTextSearchMode(false);
        setTextQuery('');
        handleSearch(result.singleUrl, false, false);
      } else if (result.error) {
        setError(result.error);
      } else {
        const list = result.results || [];
        setTextResults(list);
        if (list.length === 0) {
          setError(`No results found for "${textQuery}"`);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setTextSearchLoading(false);
    }
  };

  const handleSearch = async (searchSku, isUPC = false, fromBarcodeScan = false) => {
    const targetSku = searchSku || sku;
    if (!targetSku) {
      if (fromBarcodeScan) {
        setScannerEnabled(true);
      }
      return;
    }

    // Check if expected SKU is actually a URL
    const isURL = targetSku.toLowerCase().includes('microcenter.com');

    setLoading(true);
    setScanning(false);
    setData(null);
    setError(null);
    setStore071MergedCode(null);
    setStore071MergedCodes([]);
    
    try {
      console.log(`[handleSearch] Starting search - SKU: ${targetSku}, isUPC: ${isUPC}, fromBarcodeScan: ${fromBarcodeScan}`);
      const storeId = await AsyncStorage.getItem('storeId') || '071';
      console.log(`[handleSearch] Using storeId: ${storeId}`);
      const result = await fetchProductBySku(targetSku, storeId, (msg) => setLoadingStatus(msg));
      console.log(`[handleSearch] Result received:`, JSON.stringify(result, null, 2).substring(0, 500));
      
      setLoading(false);
      setLoadingStatus('');
    
    if (result.error) {
      console.log(`[handleSearch] Error in result: ${result.error}`);
      if (result.error === "noResults") {
        if (!noResultsAlertActive.current) {
          noResultsAlertActive.current = true;
          Alert.alert(
            "Product Not Found", 
            `Scanned Text: ${result.searchedSku}`,
            [
              {
                text: "OK",
                onPress: () => {
                  noResultsAlertActive.current = false;
                  setError(`Incorrect SKU Entry\n\nNo matches found for SKU: ${result.searchedSku}\n\nPlease verify the SKU and try again.`);
                  if (fromBarcodeScan) setScannerEnabled(true);
                }
              }
            ]
          );
        }
      } else if (result.error === "skuMismatch") {
        // Check if the input was a standard 6-digit numeric SKU
        const isNumericSku = /^\d{6}$/.test(targetSku);
        
        // If it was a UPC, URL, or non-numeric code (like SC1113), accept the redirect automatically.
        // Codes often redirect to SKUs, so this is usually a success case.
        if (isUPC || isURL || !isNumericSku) {
           console.log("Auto-redirecting mismatch for Code/UPC/URL. Loading:", result.foundSku);
           handleSearch(result.foundSku, false);
        } else if (!mismatchAlertActive.current) {
           // Mismatch on a proper 6-digit SKU. Show alert with options (at most once at a time).
           mismatchAlertActive.current = true;
            Alert.alert(
              "SKU Mismatch", 
              `Scanned: ${targetSku}\nFound SKU: ${result.foundSku}`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => {
                    mismatchAlertActive.current = false;
                    setError(`Incorrect SKU Entry\n\nYou searched for: ${targetSku}\n\nPlease verify the SKU and try again.`);
                  }
                },
                { 
                  text: "View Found Product", 
                  onPress: () => {
                    mismatchAlertActive.current = false;
                    handleSearch(result.foundSku, false);
                  }
                }
              ]
            );
        }
      } else {
        Alert.alert("Error", result.error);
      }
    } else if (result.sku && result.sku !== targetSku && !isUPC && !isURL) {
      // SKU mismatch - Micro Center redirected to a different product
      setError(`Incorrect SKU Entry\n\nYou searched for: ${targetSku}\n\nPlease verify the SKU and try again.`);
      setData(null);
    } else if (result.sku && result.sku !== targetSku && (isUPC || isURL)) {
       // It was a UPC or URL search that resolved to a valid SKU - Accept it
       const finalData = { ...result, sku: result.sku }; // Use the found SKU
       // If it was a URL, update the input field to the clean SKU so it looks nice
       if (isURL) setSku(result.sku);
       setData(finalData);
       setStore071MergedCode(lookupStore071MergedCode(String(finalData.sku ?? '')));
       setStore071MergedCodes(lookupStore071MergedCodes(String(finalData.sku ?? '')));
       setValidImageUrls(result.imageUrls || []);
       addToHistory(finalData);
    } else {
      const finalData = { ...result, sku: targetSku };
      setData(finalData);
      setStore071MergedCode(lookupStore071MergedCode(String(finalData.sku ?? '')));
      setStore071MergedCodes(lookupStore071MergedCodes(String(finalData.sku ?? '')));
      setValidImageUrls(result.imageUrls || []);
      addToHistory(finalData);
    }
    
    // Re-enable scanner after processing completes (noResults defers this to the alert's OK button)
    if (fromBarcodeScan && !noResultsAlertActive.current) {
      console.log('[handleSearch] Re-enabling scanner (success)');
      setScannerEnabled(true);
    }
    } catch (error) {
      console.error('[handleSearch] Catch block - Search error:', error);
      console.error('[handleSearch] Error stack:', error.stack);
      setLoading(false);
      setLoadingStatus('');
      setError(error.message || 'An error occurred');
      if (fromBarcodeScan) {
        console.log('[handleSearch] Re-enabling scanner (error)');
        setScannerEnabled(true);
      }
    }
  };

  const handleBarcodeScanned = ({ data }) => {
    // Disable scanner immediately to prevent multiple scans
    if (!scannerEnabled) {
      console.log('[handleBarcodeScanned] Scanner disabled, ignoring scan');
      return;
    }
    
    setScannerEnabled(false);
    console.log('[handleBarcodeScanned] Raw barcode data:', data);
    const processedData = processBarcodeData(data);
    console.log('[handleBarcodeScanned] Processed barcode data:', processedData);
    console.log('[handleBarcodeScanned] Barcode type check - isUPC:', typeof processedData === 'object' && processedData.isUPC, 'isURL:', typeof processedData === 'object' && processedData.isURL);
    
    if (typeof processedData === 'object' && processedData.isUPC) {
      setSku(processedData.value);
      setScanning(false);
      handleSearch(processedData.value, true, true); // isUPC=true, fromBarcodeScan=true
    } else if (typeof processedData === 'object' && processedData.isURL) {
      // Handle URL if needed, for now just pass value
      setSku(processedData.value);
      setScanning(false);
      handleSearch(processedData.value, false, true); // isUPC=false, fromBarcodeScan=true
    } else {
      setSku(processedData);
      setScanning(false);
      handleSearch(processedData, false, true); // isUPC=false, fromBarcodeScan=true
    }
  };

  if (scanning) {
    if (!permission?.granted) {
      return (
        <View style={[styles.container, {justifyContent: 'center', backgroundColor: theme.bg}]}>
          <Text style={{textAlign: 'center', marginBottom: 20, color: theme.text}}>Camera permission needed</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
             <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <CameraView 
          style={{ flex: 1 }} 
          onBarcodeScanned={scannerEnabled ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
          }}
        />
        <TouchableOpacity 
          style={styles.cancelScanBtn} 
          onPress={() => {
            setScanning(false);
            setScannerEnabled(true);
          }}
        >
          <Text style={styles.buttonText}>Cancel Scan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          {plansEnabled && (
            <TouchableOpacity
              style={styles.plansIconBtn}
              onPress={() => setPlansModalVisible(true)}
            >
              <Ionicons name="reader-outline" size={28} color={colors.tint} />
            </TouchableOpacity>
          )}
          <Text style={[styles.appTitle, { color: theme.text }]}>Micro SKU App</Text>
          {storeId === '071' && <Text style={styles.tagline}>Sharonville Rocks</Text>}
        </View>
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <TouchableOpacity
              style={[styles.scanButton, styles.textSearchToggleBtn, textSearchMode && styles.textSearchToggleActive]}
              onPress={() => {
                const next = !textSearchMode;
                setTextSearchMode(next);
                if (!next) {
                  // Leaving text mode: clear everything
                  setTextQuery('');
                  setTextResults([]);
                  setError(null);
                } else if (textQuery.trim()) {
                  // Re-entering text mode with a previous query: auto-search
                  handleTextSearch();
                }
              }}
            >
              <Ionicons name={textSearchMode ? 'barcode-outline' : 'search-outline'} size={24} color="white" />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
              value={textSearchMode ? textQuery : sku}
              onChangeText={textSearchMode ? setTextQuery : setSku}
              placeholder={textSearchMode ? 'Search by name, keyword...' : 'Enter SKU'}
              placeholderTextColor="gray"
              keyboardType={textSearchMode ? 'default' : 'numeric'}
              returnKeyType={textSearchMode ? 'search' : 'done'}
              onSubmitEditing={textSearchMode ? handleTextSearch : undefined}
            />
            {!textSearchMode && (
              <TouchableOpacity style={styles.scanButton} onPress={() => setScanning(true)}>
                <Ionicons name="scan" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, textSearchMode && styles.buttonTextMode]}
            onPress={() => textSearchMode ? handleTextSearch() : handleSearch(null)}
            disabled={textSearchLoading}
          >
            {textSearchLoading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.buttonText}>{textSearchMode ? 'Search' : 'Search Product'}</Text>
            }
          </TouchableOpacity>
        </View>

        {(loading || textSearchLoading) && (
          <View style={{alignItems: 'center'}}>
            <Text style={{marginTop:20, color: theme.text, textAlign: 'center'}}>Loading...</Text>
            {!!loadingStatus && (
              <Text style={{marginTop: 6, color: theme.text, textAlign: 'center', opacity: 0.6, fontSize: 13}}>{loadingStatus}</Text>
            )}
          </View>
        )}

        {/* Text search results list */}
        {textResults.length > 0 && (
          <View style={styles.textResultsList}>
            <Text style={[styles.textResultsHeader, { color: theme.text }]}>
              {textResults.length} result{textResults.length !== 1 ? 's' : ''} — tap to view
            </Text>
            {textResults.map(item => (
              <TouchableOpacity
                key={item.url}
                style={[styles.textResultRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => {
                  setTextSearchMode(false);
                  setTextResults([]);
                  handleSearch(item.url, false, false);
                }}
              >
                {item.imageUrl && (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.textResultThumb}
                    resizeMode="contain"
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.textResultName, { color: theme.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: '#aaa', fontSize: 12 }}>SKU: {item.sku}</Text>
                  {item.stockText && (() => {
                    const qtyMatch = item.stockText.match(/^(\d+)/);
                    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;
                    const isOut = qty === 0;
                    const isLow = qty !== null && qty > 0 && qty <= 5;
                    const badgeColor = isOut ? '#C00' : isLow ? '#E07000' : '#1a7a1a';
                    return (
                      <View style={[styles.textStockBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.textStockBadgeText}>{item.stockText}</Text>
                      </View>
                    );
                  })()}
                </View>
                {item.price && <Text style={styles.textResultPrice}>{item.price}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {error && (
          <View style={[styles.errorCard, { borderColor: '#C00', backgroundColor: theme.card }]}>
            <Text style={[styles.errorText, { color: '#C00' }]}>{error}</Text>
          </View>
        )}

      {data && (
        <View style={[styles.resultCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {validImageUrls && validImageUrls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.imageGallery}>
              {validImageUrls.map((imgUrl, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setMapOverlayNotice(null);
                    setMapMatches([]);
                    setMapMatchIndex(0);
                    setMapSearchCode(null);
                    setFullScreenImage(imgUrl);
                  }}
                >
                  <Image 
                    source={{ uri: imgUrl }} 
                    style={styles.productImage}
                    onError={(e) => {
                      console.log(`Image failed, removing:`, imgUrl);
                      setValidImageUrls(prev => prev.filter(url => url !== imgUrl));
                    }}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          
          {/* Price and Sale Info */}
          {data.originalPrice && data.savings && (
            <View style={styles.saleContainer}>
              <Text selectable style={[styles.originalPrice, { color: theme.text }]}>
                <Text style={styles.strikethrough}>{data.originalPrice}</Text> Save {data.savings}
              </Text>
            </View>
          )}
          
          <View style={styles.priceRow}>
            <Text selectable style={styles.price}>{data.price}</Text>
            {data.stockText && (
              <Text selectable style={[styles.stockText, { color: data.inStock ? '#00AA00' : '#DDAA00' }]}>
                {data.stockText}
              </Text>
            )}
          </View>

          {/* UI Care Banner */}
          {(() => {
            const ui = lookupUiCare(String(data.sku));
            if (!ui) return null;
            const noUiCare = ui.uiCareProduct === 'No UI Care For This Product';
            const carePrice = ui.uiCarePrice === 'NA' ? 'NA' : `$${ui.uiCarePrice}`;
            return (
              <View style={styles.uiCareBanner}>
                <Text style={styles.uiCareText}>
                  {noUiCare
                    ? 'No UI Care'
                    : `UI CARE | ${ui.productDesc} | ${ui.uiCareProduct} | ${carePrice}`}
                </Text>
              </View>
            );
          })()}

          <Text selectable style={[styles.productTitle, { color: theme.text }]}>{data.name}</Text>

          {/* Reviews + Store Area/Zone Code */}
          <View style={styles.reviewsContainer}>
            <View style={styles.reviewsRow}>
              <View style={styles.reviewsLeft}>
                {data.reviews && data.reviews.rating > 0 && (
                  <>
                    <Text selectable style={[styles.reviewStars, { color: '#FFB800' }]}> 
                      {'★'.repeat(Math.round(data.reviews.rating))}{'☆'.repeat(5 - Math.round(data.reviews.rating))}
                    </Text>
                    <Text selectable style={[styles.reviewText, { color: theme.text }]}> 
                      {data.reviews.rating.toFixed(1)}
                    </Text>
                  </>
                )}
              </View>
              <TouchableOpacity
                style={styles.storeDatCodeButton}
                activeOpacity={0.85}
                onPress={() => {
                  const codes = store071MergedCodes.length > 0
                    ? store071MergedCodes
                    : (store071MergedCode ? [store071MergedCode] : []);
                  openStoreMapForCodes(codes);
                }}
              >
                <Text style={styles.storeDatCodeButtonText}>Find Item</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Location */}
          {data.location && (
            <Text selectable style={[styles.infoText, { color: theme.text }]}>Location: {data.location}</Text>
          )}
          
          {data.mfrPart && (
            <Text selectable style={[styles.infoText, { color: theme.text }]}>Mfr Part#: {data.mfrPart}</Text>
          )}
          {data.upc && (
            <Text selectable style={[styles.infoText, { color: theme.text }]}>UPC: {data.upc}</Text>
          )}

          {/* Pro Installation Section */}
          {data.proInstallation && data.proInstallation.length > 0 && (
            <View style={styles.servicesContainer}>
              <Text selectable style={[styles.sectionHeader, { color: theme.text }]}>Pro Installation</Text>
              {data.proInstallation.map((service, idx) => (
                <Text selectable key={idx} style={[styles.serviceText, { color: theme.text }]}>
                  • {service.name} - ${service.price.toFixed(2)}
                </Text>
              ))}
            </View>
          )}

          {/* Protection Plans Section */}
          {data.protectionPlans && data.protectionPlans.length > 0 && (
            <View style={styles.servicesContainer}>
              <Text selectable style={[styles.sectionHeader, { color: theme.text }]}>Protect and Support</Text>
              {data.protectionPlans.map((plan, idx) => (
                <Text selectable key={idx} style={[styles.serviceText, { color: theme.text }]}>
                  • {plan.name} - ${plan.price.toFixed(2)}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity 
            style={styles.specsHeader}
            onPress={() => setExpandedSpecs(!expandedSpecs)}
          >
            <Text selectable style={[styles.sectionHeader, { color: theme.text }]}>
              Specifications ({data.specs.length})
            </Text>
            <Ionicons 
              name={expandedSpecs ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={theme.text} 
            />
          </TouchableOpacity>
          
          {expandedSpecs && (
            <ScrollView style={styles.specsContainer} nestedScrollEnabled={true}>
              {data.specs.map((spec, i) => (
                <Text selectable key={i} style={[styles.specText, { color: theme.text }]}>
                  • {spec}
                </Text>
              ))}
            </ScrollView>
          )}

          {/* Open Product Page Button */}
          {data.url && (
            <TouchableOpacity 
              style={styles.openPageButton} 
              onPress={() => Linking.openURL(data.url)}
            >
              <Text style={styles.openPageButtonText}>Open Product Page</Text>
            </TouchableOpacity>
          )}

          {/* Add to PC Builder Button */}

          {/* Add to List Button — shown when List tab is active */}
          {listTabActive && (
            <TouchableOpacity
              style={[
                styles.addToBuilderButton,
                { backgroundColor: addingToList ? '#aaa' : '#1a7a1a' },
              ]}
              onPress={handleAddToList}
              disabled={addingToList}
            >
              <Ionicons name="list" size={20} color="white" />
              <Text style={[styles.addToBuilderButtonText, { color: 'white' }]}>
                {addingToList ? 'Adding...' : 'Add to List'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal
        visible={showListPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowListPickerModal(false); setPendingListItem(null); }}
      >
        <View style={styles.listPickerOverlay}>
          <View style={[styles.listPickerBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.listPickerTitle, { color: theme.text }]}>Add to Which List?</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {availableListsForPicker.map(list => (
                <TouchableOpacity
                  key={list.id}
                  style={[styles.listPickerRow, { borderBottomColor: theme.border }]}
                  onPress={async () => {
                    if (!pendingListItem) return;
                    const raw = await AsyncStorage.getItem(LIST_STORAGE_KEY);
                    const allLists: ItemList[] = raw ? JSON.parse(raw) : [];
                    const updated = allLists.map(l =>
                      l.id === list.id ? { ...l, items: [...l.items, pendingListItem] } : l
                    );
                    await AsyncStorage.setItem(LIST_STORAGE_KEY, JSON.stringify(updated));
                    setShowListPickerModal(false);
                    setPendingListItem(null);
                    Alert.alert('Added!', `"${pendingListItem.name}" added to "${list.name}".`);
                  }}
                >
                  <Text style={[styles.listPickerRowText, { color: theme.text }]}>{list.name}</Text>
                  <Text style={{ color: '#aaa', fontSize: 13 }}>{list.items.length} items</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.listPickerCancelBtn}
              onPress={() => { setShowListPickerModal(false); setPendingListItem(null); }}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#555' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal
        visible={fullScreenImage !== null}
        transparent={true}
        onRequestClose={() => {
          resetImageTransform();
          setMapOverlayNotice(null);
          setMapMatches([]);
          setMapMatchIndex(0);
          setMapSearchCode(null);
          setFullScreenImage(null);
        }}
      >
        <GestureHandlerRootView style={styles.fullScreenContainer}>
          <PanGestureHandler 
            onGestureEvent={onPanGesture}
            onEnded={onPanEnd}
            simultaneousHandlers={['pinch']}
          >
            <Animated.View style={styles.fullScreenGestureSurface}>
              <PinchGestureHandler 
                onGestureEvent={onPinchGesture}
                onEnded={onPinchEnd}
                simultaneousHandlers={['pan']}
              >
                <Animated.View
                  style={[
                    styles.fullScreenTouchable,
                    fullScreenImage === STORE_071_MAP_IMAGE
                      ? { width: MAP_LOGICAL_W, height: MAP_LOGICAL_H }
                      : styles.fullScreenFit,
                    animatedStyle,
                  ]}
                >
                  {fullScreenImage !== null && (
                    <Image
                      source={typeof fullScreenImage === 'number' ? fullScreenImage : { uri: fullScreenImage }}
                      style={
                        fullScreenImage === STORE_071_MAP_IMAGE
                          ? { width: MAP_LOGICAL_W, height: MAP_LOGICAL_H }
                          : styles.fullScreenImage
                      }
                      resizeMode="contain"
                      resizeMethod="scale"
                      fadeDuration={0}
                    />
                  )}
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
          {fullScreenImage === STORE_071_MAP_IMAGE && mapMatches.length > 0 ? (
            <View style={styles.mapNoticeBanner}>
              <TouchableOpacity style={styles.mapArrowButton} onPress={handlePrevMapMatch}>
                <Ionicons name="chevron-back" size={20} color="white" />
              </TouchableOpacity>
              <Text style={styles.mapNoticeText} numberOfLines={1}>
                {`Map Location: ${(mapMatches[mapMatchIndex]?.text || mapSearchCode || 'Unknown')} (${mapMatchIndex + 1}/${mapMatches.length})`}
              </Text>
              <TouchableOpacity style={styles.mapArrowButton} onPress={handleNextMapMatch}>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </TouchableOpacity>
            </View>
          ) : mapOverlayNotice ? (
            <View style={styles.mapNoticeBanner}>
              <Text style={styles.mapNoticeText}>{mapOverlayNotice}</Text>
            </View>
          ) : null}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => {
              resetImageTransform();
              setMapOverlayNotice(null);
              setMapMatches([]);
              setMapMatchIndex(0);
              setMapSearchCode(null);
              setFullScreenImage(null);
            }}
          >
            <Ionicons name="close" size={50} color="white" />
          </TouchableOpacity>
        </GestureHandlerRootView>
      </Modal>

      {/* Plans Modal */}
      <PlansModal
        visible={plansModalVisible}
        onClose={() => setPlansModalVisible(false)}
        department={department}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { marginTop: Dimensions.get('window').height * 0.15, marginBottom: 30, alignItems: 'center', position: 'relative', width: '100%' },
  appTitle: { fontSize: 36, fontWeight: 'bold', color: '#000' },
  tagline: { fontSize: 14, color: '#999', marginTop: 4 },
  topSpacer: { height: '5%' },
  searchWrapper: { marginBottom: 20, alignItems: 'center' },
  searchBox: { flexDirection: 'row', marginBottom: 15, gap: 10, width: '100%', maxWidth: 400 },
  input: { flex: 1, borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 16, borderColor: '#ccc' },
  scanButton: { backgroundColor: '#0173DF', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: 50 },
  button: { backgroundColor: '#0173DF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  errorCard: { marginTop: 20, padding: 20, borderWidth: 2, borderRadius: 8, backgroundColor: '#FFF5F5' },
  errorText: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  resultCard: { marginTop: 10, padding: 15, borderWidth: 1, borderRadius: 8, borderColor: '#ccc' },
  imageGallery: { marginBottom: 10 },
  productImage: { width: 300, height: 200, resizeMode: 'contain', marginRight: 10, backgroundColor: '#f0f0f0' },
  saleContainer: { marginTop: 8 },
  originalPrice: { fontSize: 16, fontWeight: '600' },
  strikethrough: { textDecorationLine: 'line-through', color: '#999' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  price: { fontSize: 28, fontWeight: 'bold', color: '#C00' },
  stockText: { fontSize: 14, fontWeight: '600' },
  productTitle: { fontSize: 18, marginVertical: 10, fontWeight: '600' },
  infoText: { fontSize: 14, marginBottom: 5 },
  reviewsContainer: { marginVertical: 10 },
  reviewsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reviewsLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  reviewStars: { fontSize: 18 },
  reviewText: { fontSize: 14, fontWeight: '500' },
  storeDatCodeButton: { backgroundColor: '#C00', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  storeDatCodeButtonText: { color: 'white', fontSize: 13, fontWeight: '700' },
  servicesContainer: { marginVertical: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#ddd' },
  serviceText: { fontSize: 14, marginLeft: 10, marginBottom: 4 },
  specsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingVertical: 8 },
  sectionHeader: { fontWeight: 'bold', fontSize: 16 },
  specsContainer: { maxHeight: 300, marginTop: 5 },
  specText: { marginLeft: 10, marginBottom: 6, fontSize: 13 },
  openPageButton: { backgroundColor: '#0173DF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15, marginBottom: 10 },
  openPageButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  addToBuilderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 8, marginBottom: 10 },
  addToBuilderButtonText: { fontWeight: 'bold', fontSize: 16 },
  cancelScanBtn: { position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'red', padding: 15, borderRadius: 30 },
  fullScreenContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.98)', justifyContent: 'center', alignItems: 'center' },
    fullScreenGestureSurface: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
    fullScreenTouchable: { justifyContent: 'center', alignItems: 'center' },
    fullScreenFit: { flex: 1, width: '100%' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 5 },
  mapNoticeBanner: { position: 'absolute', left: 16, right: 16, top: 122, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapNoticeText: { color: 'white', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'center' },
  mapArrowButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  plansIconBtn: { position: 'absolute', top: -115, right: 0, zIndex: 5, padding: 6 },
  listPickerOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  listPickerBox:       { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: 36 },
  listPickerTitle:     { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  listPickerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1 },
  listPickerRowText:   { fontSize: 17, fontWeight: '500' },
  listPickerCancelBtn: { marginTop: 16, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  textSearchToggleBtn:    { backgroundColor: '#C00' },
  textSearchToggleActive: { backgroundColor: '#0a7a0a' },
  buttonTextMode:      { backgroundColor: '#0a7a0a' },
  textResultsList:     { marginTop: 10 },
  textResultsHeader:   { fontSize: 13, color: '#aaa', marginBottom: 8, textAlign: 'center' },
  textResultRow:       { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8, gap: 10 },
  textResultThumb:     { width: 64, height: 64, borderRadius: 6, backgroundColor: '#f0f0f0' },
  textResultName:      { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  textResultStock:     { fontSize: 12, fontWeight: '600', marginTop: 2 },
  textStockBadge:      { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  textStockBadgeText:  { color: 'white', fontSize: 11, fontWeight: 'bold' },
  textResultPrice:     { fontSize: 16, fontWeight: 'bold', color: '#C00', minWidth: 60, textAlign: 'right' },
  uiCareBanner:        { backgroundColor: '#FFD700', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10, marginBottom: 4 },
  uiCareText:          { color: '#C00', fontWeight: '700', fontSize: 13 },
});
