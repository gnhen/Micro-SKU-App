import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  StyleSheet, Alert, Image, Modal, Dimensions, StatusBar, Linking, ActivityIndicator
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
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [storeId, setStoreId] = useState('071');
  const [expandedSpecs, setExpandedSpecs] = useState(true);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [validImageUrls, setValidImageUrls] = useState([]);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [addingToBuilder, setAddingToBuilder] = useState(false);
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [addingToList, setAddingToList] = useState(false);
  const [showListPickerModal, setShowListPickerModal] = useState(false);
  const [pendingListItem, setPendingListItem] = useState<ListItem | null>(null);
  const [availableListsForPicker, setAvailableListsForPicker] = useState<ItemList[]>([]);

  const mismatchAlertActive = useRef(false);

  // Text search mode
  const [textSearchMode, setTextSearchMode] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const [textResults, setTextResults] = useState<{sku: string, name: string, price: string | null, url: string}[]>([]);
  const [textSearchLoading, setTextSearchLoading] = useState(false);

  const { selectedTabs } = useSettings();
  const listTabActive = selectedTabs.includes('list');
  
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetImageTransform = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const onPinchGesture = (event) => {
    scale.value = savedScale.value * event.nativeEvent.scale;
  };

  const onPinchEnd = (event) => {
    savedScale.value = scale.value;
    if (scale.value < 1) {
      scale.value = withSpring(1);
      savedScale.value = 1;
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
    
    try {
      console.log(`[handleSearch] Starting search - SKU: ${targetSku}, isUPC: ${isUPC}, fromBarcodeScan: ${fromBarcodeScan}`);
      const storeId = await AsyncStorage.getItem('storeId') || '071';
      console.log(`[handleSearch] Using storeId: ${storeId}`);
      const result = await fetchProductBySku(targetSku, storeId);
      console.log(`[handleSearch] Result received:`, JSON.stringify(result, null, 2).substring(0, 500));
      
      setLoading(false);
    
    if (result.error) {
      console.log(`[handleSearch] Error in result: ${result.error}`);
      if (result.error === "noResults") {
        Alert.alert(
          "Product Not Found", 
          `Scanned Text: ${result.searchedSku}`,
          [
            {
              text: "OK",
              onPress: () => {
                setError(`Incorrect SKU Entry\n\nNo matches found for SKU: ${result.searchedSku}\n\nPlease verify the SKU and try again.`);
              }
            }
          ]
        );
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
       setValidImageUrls(result.imageUrls || []);
       addToHistory(finalData);
    } else {
      const finalData = { ...result, sku: targetSku };
      setData(finalData);
      setValidImageUrls(result.imageUrls || []);
      addToHistory(finalData);
    }
    
    // Always re-enable scanner after processing completes
    if (fromBarcodeScan) {
      console.log('[handleSearch] Re-enabling scanner (success)');
      setScannerEnabled(true);
    }
    } catch (error) {
      console.error('[handleSearch] Catch block - Search error:', error);
      console.error('[handleSearch] Error stack:', error.stack);
      setLoading(false);
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
          <Text style={[styles.appTitle, { color: theme.text }]}>Micro SKU App</Text>
          {storeId === '071' && <Text style={styles.tagline}>Sharonville rocks</Text>}
        </View>
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
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
            <TouchableOpacity
              style={[styles.scanButton, textSearchMode && styles.scanButtonActive]}
              onPress={() => {
                const next = !textSearchMode;
                setTextSearchMode(next);
                setTextQuery('');
                setTextResults([]);
                if (!next) setError(null);
              }}
            >
              <Ionicons name={textSearchMode ? 'barcode-outline' : 'search-outline'} size={24} color="white" />
            </TouchableOpacity>
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

        {(loading || textSearchLoading) && <Text style={{marginTop:20, color: theme.text, textAlign: 'center'}}>Loading...</Text>}

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
                  setTextQuery('');
                  setTextResults([]);
                  handleSearch(item.url, false, false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.textResultName, { color: theme.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: '#aaa', fontSize: 12 }}>SKU: {item.sku}</Text>
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
                <TouchableOpacity key={idx} onPress={() => setFullScreenImage(imgUrl)}>
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
          <Text selectable style={[styles.productTitle, { color: theme.text }]}>{data.name}</Text>

          {/* Reviews Section */}
          {data.reviews && data.reviews.rating > 0 && (
            <View style={styles.reviewsContainer}>
              <View style={styles.reviewsRow}>
                <Text selectable style={[styles.reviewStars, { color: '#FFB800' }]}>
                  {'★'.repeat(Math.round(data.reviews.rating))}{'☆'.repeat(5 - Math.round(data.reviews.rating))}
                </Text>
                <Text selectable style={[styles.reviewText, { color: theme.text }]}>
                  {data.reviews.rating.toFixed(1)}
                </Text>
              </View>
            </View>
          )}

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
          setFullScreenImage(null);
        }}
      >
        <GestureHandlerRootView style={styles.fullScreenContainer}>
          <PanGestureHandler 
            onGestureEvent={onPanGesture}
            onEnded={onPanEnd}
            simultaneousHandlers={['pinch']}
          >
            <Animated.View style={{ flex: 1, width: '100%' }}>
              <PinchGestureHandler 
                onGestureEvent={onPinchGesture}
                onEnded={onPinchEnd}
                simultaneousHandlers={['pan']}
              >
                <Animated.View style={[styles.fullScreenTouchable, animatedStyle]}>
                  {fullScreenImage && (
                    <Image
                      source={{ uri: fullScreenImage }}
                      style={styles.fullScreenImage}
                      resizeMode="contain"
                    />
                  )}
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => {
              resetImageTransform();
              setFullScreenImage(null);
            }}
          >
            <Ionicons name="close" size={50} color="white" />
          </TouchableOpacity>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { marginTop: Dimensions.get('window').height * 0.15, marginBottom: 30, alignItems: 'center' },
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
  reviewsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewStars: { fontSize: 18 },
  reviewText: { fontSize: 14, fontWeight: '500' },
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
  fullScreenTouchable: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 5 },
  listPickerOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  listPickerBox:       { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: 36 },
  listPickerTitle:     { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  listPickerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1 },
  listPickerRowText:   { fontSize: 17, fontWeight: '500' },
  listPickerCancelBtn: { marginTop: 16, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  scanButtonActive:    { backgroundColor: '#005bb5' },
  buttonTextMode:      { backgroundColor: '#0a7a0a' },
  textResultsList:     { marginTop: 10 },
  textResultsHeader:   { fontSize: 13, color: '#aaa', marginBottom: 8, textAlign: 'center' },
  textResultRow:       { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8, gap: 10 },
  textResultName:      { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  textResultPrice:     { fontSize: 16, fontWeight: 'bold', color: '#C00', minWidth: 60, textAlign: 'right' },
});
