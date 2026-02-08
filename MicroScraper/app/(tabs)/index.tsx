import React, { useState, useEffect } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  StyleSheet, Alert, Image, Modal, Dimensions, StatusBar, Linking 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { fetchProductBySku } from '../../services/scraper';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';

// Helper function to process scanned barcode data
const processBarcodeData = (scannedData) => {
  // Aggressively clean invisible characters which might mess up regex/length checks
  const trimmedData = scannedData.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
  const charCount = trimmedData.length;
  
  console.log(`Processing barcode: "${trimmedData}" (Length: ${charCount})`);

  // 1. URL Check
  if (trimmedData.toLowerCase().includes('microcenter.com')) {
    return { value: trimmedData, isURL: true };
  }
  
  // 2. Exact 6 digits Check (Direct SKU)
  if (charCount === 6) {
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
    return { value: trimmedData, isUPC: true };
  }
  
  // Fallback
  return trimmedData;
};

export default function ScanScreen() {
  const [sku, setSku] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isDark, setIsDark] = useState(false);
  const [storeId, setStoreId] = useState('071');
  const [expandedSpecs, setExpandedSpecs] = useState(true);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [validImageUrls, setValidImageUrls] = useState([]);
  
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
      AsyncStorage.getItem('isDark').then(val => {
        if (val !== null) setIsDark(JSON.parse(val));
      });
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

  const theme = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    text: isDark ? '#ffffff' : '#000000',
    card: isDark ? '#333333' : '#f9f9f9',
    border: isDark ? '#444444' : '#eeeeee',
    inputBg: isDark ? '#2a2a2a' : '#ffffff',
    primary: '#007AFF',
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

  const handleSearch = async (searchSku, isUPC = false) => {
    const targetSku = searchSku || sku;
    if (!targetSku) return;

    // Check if expected SKU is actually a URL
    const isURL = targetSku.toLowerCase().includes('microcenter.com');

    setLoading(true);
    setScanning(false);
    setData(null);
    setError(null);
    
    const storeId = await AsyncStorage.getItem('storeId') || '071';
    const result = await fetchProductBySku(targetSku, storeId);
    
    setLoading(false);
    
    if (result.error) {
      if (result.error === "noResults") {
        Alert.alert(
          "Product Not Found", 
          `Scanned Text: ${result.searchedSku}`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => {
                setError(`Incorrect SKU Entry\n\nNo matches found for SKU: ${result.searchedSku}\n\nPlease verify the SKU and try again.`);
              }
            },
            { 
              text: "Scan for Manufacturer Code?", 
              onPress: () => setScanning(true) 
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
        } else {
           // Mismatch on a proper 6-digit SKU. Show alert with options.
            Alert.alert(
              "SKU Mismatch", 
              `Scanned: ${targetSku}\nFound SKU: ${result.foundSku}`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => setError(`Incorrect SKU Entry\n\nYou searched for: ${targetSku}\n\nPlease verify the SKU and try again.`)
                },
                { 
                  text: "Scan for Manufacturer Code?", 
                  onPress: () => setScanning(true) 
                },
                { 
                  text: "View Found Product", 
                  onPress: () => handleSearch(result.foundSku, false) 
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
  };

  const handleBarcodeScanned = ({ data }) => {
    console.log('Raw barcode data:', data);
    const processedData = processBarcodeData(data);
    console.log('Processed barcode data:', processedData);
    
    if (typeof processedData === 'object' && processedData.isUPC) {
      setSku(processedData.value);
      setScanning(false);
      handleSearch(processedData.value, true); // Pass isUPC=true
    } else if (typeof processedData === 'object' && processedData.isURL) {
      // Handle URL if needed, for now just pass value
      setSku(processedData.value);
      setScanning(false);
      handleSearch(processedData.value, false);
    } else {
      setSku(processedData);
      setScanning(false);
      handleSearch(processedData, false);
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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
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
              value={sku} 
              onChangeText={setSku} 
              placeholder="Enter SKU" 
              placeholderTextColor="gray"
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.scanButton} onPress={() => setScanning(true)}>
              <Ionicons name="scan" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.button} onPress={() => handleSearch(null)}>
            <Text style={styles.buttonText}>Search Product</Text>
          </TouchableOpacity>
        </View>

        {loading && <Text style={{marginTop:20, color: theme.text, textAlign: 'center'}}>Loading...</Text>}

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
        </View>
      )}
      </ScrollView>

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
  scanButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: 50 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
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
  cancelScanBtn: { position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'red', padding: 15, borderRadius: 30 },
  fullScreenContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.98)', justifyContent: 'center', alignItems: 'center' },
  fullScreenTouchable: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 5 },
});
