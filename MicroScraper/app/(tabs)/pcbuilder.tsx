import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  getCategories,
  getCategoryURL,
  getExtractionScript,
  handleWebViewMessage,
  getCachedComponents,
  clearCache,
} from '@/services/pcBuilderWebViewScraper';

export default function PCBuilderScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [builds, setBuilds] = useState([]);
  const [currentBuildId, setCurrentBuildId] = useState(null);
  const [currentBuild, setCurrentBuild] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showNewBuildModal, setShowNewBuildModal] = useState(false);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [newBuildName, setNewBuildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('071');
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [scrapingCategory, setScrapingCategory] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [manualSku, setManualSku] = useState('');
  const [scrapingSku, setScrapingSku] = useState(null);
  const webViewRef = useRef(null);
  const skuWebViewRef = useRef(null);

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    if (currentBuildId) {
      loadCurrentBuild();
    }
  }, [currentBuildId]);

  const initializeData = async () => {
    try {
      // Get categories from scraper
      const cats = getCategories();
      setCategories(cats);
      
      // Initialize all sections as expanded
      const initialExpanded = {};
      cats.forEach(section => {
        initialExpanded[section.section] = true;
      });
      setExpandedSections(initialExpanded);
      
      // Clear cache to get fresh data with updated brand logic
      clearCache();
      
      // Load store ID from settings
      const savedStoreId = await AsyncStorage.getItem('storeId');
      if (savedStoreId) setStoreId(savedStoreId);
      
      // Load builds from AsyncStorage
      const savedBuilds = await AsyncStorage.getItem('pcBuilds');
      const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
      setBuilds(allBuilds);
      
      // Don't auto-load bundles, wait for user to select AMD or Intel
      // Bundles will be loaded when user clicks a bundle type button
      
      // Select first build if available
      if (allBuilds.length > 0 && !currentBuildId) {
        setCurrentBuildId(allBuilds[0].id);
      }
    } catch (error) {
      console.error('Error initializing data:', error);
      Alert.alert('Error', 'Failed to initialize PC Builder');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentBuild = async () => {
    try {
      const savedBuilds = await AsyncStorage.getItem('pcBuilds');
      const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
      const build = allBuilds.find(b => b.id === currentBuildId);
      
      if (build) {
        // Use bundle prices if applied, otherwise use regular prices
        const totalPrice = build.components?.reduce((sum, c) => {
          const price = c.bundlePrice || c.sale_price || c.price || 0;
          // Handle both numeric and string prices (like 'N/A')
          const numericPrice = typeof price === 'number' ? price : 0;
          return sum + numericPrice;
        }, 0) || 0;
        
        // Calculate original price for comparison
        const originalTotalPrice = build.components?.reduce((sum, c) => {
          const price = c.originalPrice || c.sale_price || c.price || 0;
          // Handle both numeric and string prices (like 'N/A')
          const numericPrice = typeof price === 'number' ? price : 0;
          return sum + numericPrice;
        }, 0) || 0;
        
        setCurrentBuild({
          ...build,
          total_price: totalPrice,
          original_total_price: build.appliedBundle ? originalTotalPrice : null,
          appliedBundle: build.appliedBundle,
        });
      }
    } catch (error) {
      console.error('Error loading build:', error);
    }
  };

  const handleCreateBuild = async () => {
    if (!newBuildName.trim()) {
      Alert.alert('Error', 'Please enter a build name');
      return;
    }

    try {
      const newBuild = {
        id: Date.now(),
        name: newBuildName.trim(),
        components: [],
        created_at: new Date().toISOString(),
      };
      
      const savedBuilds = await AsyncStorage.getItem('pcBuilds');
      const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
      allBuilds.push(newBuild);
      
      await AsyncStorage.setItem('pcBuilds', JSON.stringify(allBuilds));
      
      setNewBuildName('');
      setShowNewBuildModal(false);
      await initializeData();
      setCurrentBuildId(newBuild.id);
    } catch (error) {
      console.error('Error creating build:', error);
      Alert.alert('Error', 'Failed to create build');
    }
  };

  const handleDeleteBuild = async (buildId) => {
    Alert.alert(
      'Delete Build',
      'Are you sure you want to delete this build?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const savedBuilds = await AsyncStorage.getItem('pcBuilds');
              const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
              const updatedBuilds = allBuilds.filter(b => b.id !== buildId);
              
              await AsyncStorage.setItem('pcBuilds', JSON.stringify(updatedBuilds));
              
              if (currentBuildId === buildId) {
                setCurrentBuildId(null);
                setCurrentBuild(null);
              }
              await initializeData();
            } catch (error) {
              console.error('Error deleting build:', error);
              Alert.alert('Error', 'Failed to delete build');
            }
          },
        },
      ]
    );
  };

  const handleSelectComponent = async (category) => {
    setSelectedCategory(category);
    
    // Check cache first
    const cached = getCachedComponents(category.id);
    if (cached && cached.length > 0) {
      setAvailableComponents(cached);
      setShowComponentModal(true);
      return;
    }
    
    // Start WebView scraping
    setLoadingComponents(true);
    setShowComponentModal(true);
    setScrapingCategory(category.id);
  };

  const handleAddManualSku = async () => {
    if (!manualSku.trim() || !currentBuildId || !selectedCategory) {
      Alert.alert('Invalid SKU', 'Please enter a valid SKU number.');
      return;
    }

    // Add a temporary loading component
    const tempComponent = {
      sku: manualSku.trim(),
      name: 'Loading...',
      category_name: selectedCategory.name,
      category_display: selectedCategory.display_name,
      price: 'Loading...',
      image: null,
      isLoading: true,
    };
    
    await handleAddComponent(tempComponent);
    
    // Start scraping by searching for the SKU
    setShowSkuModal(false);
    setScrapingSku({
      sku: manualSku.trim(),
      category: selectedCategory
    });
  };

  const handleAddComponent = async (component) => {
    try {
      const savedBuilds = await AsyncStorage.getItem('pcBuilds');
      const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
      const buildIndex = allBuilds.findIndex(b => b.id === currentBuildId);
      
      if (buildIndex === -1) {
        throw new Error('Build not found');
      }
      
      // Add component with category name
      const componentWithCategory = {
        ...component,
        category_name: selectedCategory.name,
      };
      
      // Only remove existing component if category doesn't allow multiple
      if (!selectedCategory.allowMultiple) {
        allBuilds[buildIndex].components = allBuilds[buildIndex].components?.filter(
          c => c.category_name !== selectedCategory.name
        ) || [];
      }
      
      // Add new component
      allBuilds[buildIndex].components.push(componentWithCategory);
      
      await AsyncStorage.setItem('pcBuilds', JSON.stringify(allBuilds));
      await loadCurrentBuild();
      setShowComponentModal(false);
    } catch (error) {
      console.error('Error adding component:', error);
      Alert.alert('Error', 'Failed to add component');
    }
  };

  const handleRemoveComponent = async (categoryName, sku = null) => {
    Alert.alert(
      'Remove Component',
      'Remove this component from your build?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeComponent(categoryName, sku);
          },
        },
      ]
    );
  };

  const removeComponent = async (categoryName, sku = null) => {
    try {
      const savedBuilds = await AsyncStorage.getItem('pcBuilds');
      const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
      const buildIndex = allBuilds.findIndex(b => b.id === currentBuildId);
      
      if (buildIndex !== -1) {
        if (sku) {
          // Remove specific component by SKU (for multiple items)
          const componentIndex = allBuilds[buildIndex].components?.findIndex(
            c => c.category_name === categoryName && c.sku === sku
          );
          if (componentIndex !== -1) {
            allBuilds[buildIndex].components.splice(componentIndex, 1);
          }
        } else {
          // Remove all components in this category (for single items)
          allBuilds[buildIndex].components = allBuilds[buildIndex].components?.filter(
            c => c.category_name !== categoryName
          ) || [];
        }
        
        await AsyncStorage.setItem('pcBuilds', JSON.stringify(allBuilds));
        await loadCurrentBuild();
      }
    } catch (error) {
      console.error('Error removing component:', error);
      Alert.alert('Error', 'Failed to remove component');
    }
  };

  const getBuildComponentForCategory = (categoryName) => {
    return currentBuild?.components?.find(c => c.category_name === categoryName);
  };

  const getBuildComponentsForCategory = (categoryName) => {
    return currentBuild?.components?.filter(c => c.category_name === categoryName) || [];
  };

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Fetch component details from Microcenter product page
  const fetchComponentDetails = async (sku) => {
    return new Promise((resolve) => {
      // Create a temporary WebView to scrape product details
      const productUrl = `https://www.microcenter.com/product/${sku}`;
      console.log('[Component Fetch] Fetching details for:', productUrl);
      
      // For now, return a basic structure - in a full implementation,
      // you'd scrape the product page to get the actual name and image
      // This would require another hidden WebView
      setTimeout(() => {
        resolve({
          name: `Product ${sku}`,
          image: null,
        });
      }, 100);
    });
  };

  const generatePDF = async () => {
    if (!currentBuild || !currentBuild.components || currentBuild.components.length === 0) {
      Alert.alert('Empty Build', 'Add components to your build before generating a PDF.');
      return;
    }

    try {
      // Store information mapping
      const storeInfo = {
        '025': { name: 'Microcenter - Westmont, IL', taxRate: 0.0925 },
        '041': { name: 'Microcenter - Marietta, GA', taxRate: 0.07 },
        '045': { name: 'Microcenter - St. Louis Park, MN', taxRate: 0.07875 },
        '051': { name: 'Microcenter - Mayfield Heights, OH', taxRate: 0.08 },
        '055': { name: 'Microcenter - Madison Heights, MI', taxRate: 0.06 },
        '061': { name: 'Microcenter - St. Davids, PA', taxRate: 0.06 },
        '065': { name: 'Microcenter - Duluth, GA', taxRate: 0.07 },
        '071': { name: 'Microcenter - Sharonville, OH', taxRate: 0.0725 },
        '075': { name: 'Microcenter - North Jersey, NJ', taxRate: 0.06625 },
        '081': { name: 'Microcenter - Fairfax, VA', taxRate: 0.06 },
        '085': { name: 'Microcenter - Rockville, MD', taxRate: 0.06 },
        '095': { name: 'Microcenter - Brentwood, MO', taxRate: 0.09238 },
        '101': { name: 'Microcenter - Tustin, CA', taxRate: 0.0775 },
        '105': { name: 'Microcenter - Yonkers, NY', taxRate: 0.08375 },
        '115': { name: 'Microcenter - Brooklyn, NY', taxRate: 0.08875 },
        '121': { name: 'Microcenter - Cambridge, MA', taxRate: 0.0625 },
        '125': { name: 'Microcenter - Parkville, MD', taxRate: 0.06 },
        '131': { name: 'Microcenter - Dallas, TX', taxRate: 0.0825 },
        '141': { name: 'Microcenter - Columbus, OH', taxRate: 0.075 },
        '145': { name: 'Microcenter - Flushing, NY', taxRate: 0.08875 },
        '151': { name: 'Microcenter - Chicago, IL', taxRate: 0.1025 },
        '155': { name: 'Microcenter - Houston, TX', taxRate: 0.0825 },
        '165': { name: 'Microcenter - Indianapolis, IN', taxRate: 0.07 },
        '171': { name: 'Microcenter - Westbury, NY', taxRate: 0.08625 },
        '175': { name: 'Microcenter - Charlotte, NC', taxRate: 0.0725 },
        '181': { name: 'Microcenter - Denver, CO', taxRate: 0.081 },
        '185': { name: 'Microcenter - Miami, FL', taxRate: 0.07 },
        '191': { name: 'Microcenter - Overland Park, KS', taxRate: 0.09125 },
        '195': { name: 'Microcenter - Santa Clara, CA', taxRate: 0.09125 },
        '205': { name: 'Microcenter - Phoenix, AZ', taxRate: 0.083 },
      };

      const currentStore = storeInfo[storeId] || { name: `Store ${storeId}`, taxRate: 0.07 };

      // Calculate total price
      const totalPrice = currentBuild.components.reduce((sum, component) => {
        const priceStr = component.price ? String(component.price) : '0';
        const price = parseFloat(priceStr.replace(/[$,]/g, '') || '0');
        return sum + price;
      }, 0);

      const estimatedTax = totalPrice * currentStore.taxRate;
      const totalWithTax = totalPrice + estimatedTax;

      // Build HTML for the PDF
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              margin: 0;
            }
            h1 {
              color: #333;
              border-bottom: 3px solid #0066cc;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            h2 {
              color: #555;
              margin-top: 20px;
              font-size: 18px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #0066cc;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #ddd;
              vertical-align: middle;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .product-image {
              width: 60px;
              height: 60px;
              object-fit: contain;
              display: block;
            }
            .subtotal-row {
              font-weight: bold;
              background-color: #f5f5f5 !important;
            }
            .tax-row {
              font-style: italic;
              background-color: #f5f5f5 !important;
            }
            .total-row {
              font-weight: bold;
              font-size: 18px;
              background-color: #e6f2ff !important;
            }
            .total-row td {
              padding: 15px 12px;
              border-top: 2px solid #0066cc;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>${currentBuild.name}</h1>
          <p><strong>Store:</strong> ${currentStore.name}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          
          <h2>Components</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Image</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Name</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${currentBuild.components.map(component => `
                <tr>
                  <td>
                    ${component.image ? `<img src="${component.image}" class="product-image" alt="Product" />` : ''}
                  </td>
                  <td>${component.category_display || component.category_name}</td>
                  <td>${component.sku || 'N/A'}</td>
                  <td>${component.name || 'Unknown Component'}</td>
                  <td style="text-align: right;">${component.price || '$0.00'}</td>
                </tr>
              `).join('')}
              <tr class="subtotal-row">
                <td colspan="4" style="text-align: right;">Subtotal:</td>
                <td style="text-align: right;">$${totalPrice.toFixed(2)}</td>
              </tr>
              <tr class="tax-row">
                <td colspan="4" style="text-align: right;">Estimated Tax (${(currentStore.taxRate * 100).toFixed(2)}%):</td>
                <td style="text-align: right;">$${estimatedTax.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align: right;">Total:</td>
                <td style="text-align: right;">$${totalWithTax.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>This build list was generated by the Micro-SKU App.</p>
            <p>Prices and tax are estimates and may vary. Please verify availability and pricing at your local Microcenter store.</p>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html });
      
      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Success', `PDF saved to: ${uri}`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <ThemedView style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="title">PC Builder</ThemedText>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.tint }]}
            onPress={() => setShowNewBuildModal(true)}
          >
            <Ionicons name="add" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
            <Text style={[styles.headerButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>New Build</Text>
          </TouchableOpacity>
          {currentBuildId && (
            <>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: colors.tint }]}
                onPress={() => {
                  Alert.alert(
                    'Bundles Not Yet Available',
                    'This feature requires access to the MC Database. If MC gives access, this will be available!'
                  );
                }}
              >
                <Ionicons name="albums" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
                <Text style={[styles.headerButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Bundles</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: colors.tint }]}
                onPress={generatePDF}
              >
                <Ionicons name="document-text" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
                <Text style={[styles.headerButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Save PDF</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ThemedView>

      {/* Build Selector */}
      {builds.length > 0 && (
        <ScrollView
          horizontal
          style={styles.buildSelector}
          contentContainerStyle={styles.buildSelectorContent}
          showsHorizontalScrollIndicator={false}
        >
          {builds.map((build) => (
            <TouchableOpacity
              key={build.id}
              style={[
                styles.buildTab,
                { 
                  backgroundColor: currentBuildId === build.id ? colors.tint : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setCurrentBuildId(build.id)}
            >
              <Text
                style={[
                  styles.buildTabText,
                  { color: currentBuildId === build.id ? (colorScheme === 'dark' ? '#000' : '#fff') : colors.text },
                ]}
              >
                {build.name}
              </Text>
              <TouchableOpacity
                onPress={() => handleDeleteBuild(build.id)}
                style={styles.deleteBuildButton}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={currentBuildId === build.id ? (colorScheme === 'dark' ? '#000' : '#fff') : colors.icon}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Build Content */}
      {currentBuild ? (
        <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Build Summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText type="subtitle">Total Cost</ThemedText>
            {currentBuild.appliedBundle && currentBuild.original_total_price ? (
              <View>
                <Text style={[styles.originalTotalPrice, { color: colors.tabIconDefault }]}>
                  ${currentBuild.original_total_price.toFixed(2)}
                </Text>
                <ThemedText type="title" style={styles.totalPrice}>
                  ${currentBuild.total_price?.toFixed(2) || '0.00'}
                </ThemedText>
                <View style={[styles.bundleBadge, { backgroundColor: colors.notification }]}>
                  <Ionicons name="pricetag" size={16} color="white" />
                  <Text style={styles.bundleBadgeText}>
                    {currentBuild.appliedBundle.name} - Save ${currentBuild.appliedBundle.savings?.toFixed(2)}
                  </Text>
                </View>
              </View>
            ) : (
              <ThemedText type="title" style={styles.totalPrice}>
                ${currentBuild.total_price?.toFixed(2) || '0.00'}
              </ThemedText>
            )}
          </View>

          {/* Component Categories */}
          {categories.map((section) => (
            <View key={section.section}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.section)}
              >
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  {section.section}
                </ThemedText>
                <Ionicons 
                  name={expandedSections[section.section] ? "chevron-down" : "chevron-forward"} 
                  size={24} 
                  color={colors.icon} 
                />
              </TouchableOpacity>
              {expandedSections[section.section] && section.categories.map((category) => {
                const components = getBuildComponentsForCategory(category.name);
                const hasComponents = components.length > 0;
                return (
                  <View
                    key={category.id}
                    style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryTitleRow}>
                    <ThemedText type="defaultSemiBold">{category.display_name}</ThemedText>
                    {category.required === 1 && (
                      <Text style={[styles.requiredBadge, { color: colors.notification }]}>*Required</Text>
                    )}
                    {category.allowMultiple && hasComponents && (
                      <Text style={[styles.multipleIndicator, { color: colors.tint }]}>
                        ({components.length})
                      </Text>
                    )}
                  </View>
                </View>

                {hasComponents ? (
                  <View style={styles.selectedComponentsContainer}>
                    {components.map((component, index) => (
                      <View key={`${component.sku}-${index}`} style={[
                        styles.selectedComponent,
                        category.allowMultiple && index > 0 && styles.multipleComponentItem
                      ]}>
                        {component.image && (
                          <Image 
                            source={{ uri: component.image }} 
                            style={styles.selectedComponentImage}
                            resizeMode="contain"
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.componentName} numberOfLines={2}>
                            {component.name}
                          </ThemedText>
                          {component.bundleId && component.originalPrice ? (
                            <View style={styles.bundlePricingContainer}>
                              <Text style={[styles.componentOriginalPrice, { color: colors.tabIconDefault }]}>
                                ${component.originalPrice.toFixed(2)}
                              </Text>
                              <ThemedText style={styles.componentBundlePrice}>
                                ${component.bundlePrice?.toFixed(2) || component.price?.toFixed(2)}
                              </ThemedText>
                            </View>
                          ) : (
                            <ThemedText style={styles.componentPrice}>
                              {typeof component.price === 'number' ? `$${component.price.toFixed(2)}` : (component.price || 'N/A')}
                            </ThemedText>
                          )}
                        </View>
                        <TouchableOpacity 
                          onPress={() => handleRemoveComponent(category.name, component.sku)}
                          style={styles.removeComponentButton}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.icon} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {category.allowMultiple && (
                      <TouchableOpacity
                        style={[styles.addMoreButton, { borderColor: colors.tint }]}
                        onPress={() => handleSelectComponent(category)}
                      >
                        <Ionicons name="add-circle-outline" size={20} color={colors.tint} />
                        <Text style={[styles.addMoreButtonText, { color: colors.tint }]}>
                          Add Another {category.display_name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.selectButton, { borderColor: colors.tint }]}
                    onPress={() => handleSelectComponent(category)}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={colors.tint} />
                    <Text style={[styles.selectButtonText, { color: colors.tint }]}>
                      Select {category.display_name}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
          <Ionicons name="construct" size={64} color={colors.icon} />
          <ThemedText style={styles.emptyText}>No build selected</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Create a new build to get started
          </ThemedText>
        </View>
      )}

      {/* New Build Modal */}
      <Modal
        visible={showNewBuildModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewBuildModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ThemedText type="subtitle">Create New Build</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="Build Name (e.g., Gaming PC 2026)"
              placeholderTextColor={colors.tabIconDefault}
              value={newBuildName}
              onChangeText={setNewBuildName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => setShowNewBuildModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
                onPress={handleCreateBuild}
              >
                <Text style={[styles.modalButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Component Selection Modal */}
      <Modal
        visible={showComponentModal}
        animationType="slide"
        onRequestClose={() => setShowComponentModal(false)}
      >
        <SafeAreaView style={[styles.fullModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: 60 }]}>
            <ThemedText type="subtitle">
              Select {selectedCategory?.display_name}
            </ThemedText>
            <TouchableOpacity onPress={() => setShowComponentModal(false)}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>
          {!loadingComponents && (
            <TouchableOpacity
              style={[styles.enterSkuButton, { backgroundColor: colors.tint, marginHorizontal: 16, marginVertical: 12 }]}
              onPress={() => {
                setShowComponentModal(false);
                setTimeout(() => setShowSkuModal(true), 300);
              }}
            >
              <Ionicons name="keypad" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
              <Text style={[styles.enterSkuButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Enter SKU</Text>
            </TouchableOpacity>
          )}
          {loadingComponents ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <ThemedText style={{ marginTop: 16 }}>
                Loading {selectedCategory?.display_name} from Microcenter...
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={availableComponents}
              keyExtractor={(item, index) => `${item.sku || 'unknown'}-${index}`}
              renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.componentItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleAddComponent(item)}
              >
                {item.image && (
                  <Image 
                    source={{ uri: item.image }} 
                    style={styles.componentImage}
                    resizeMode="contain"
                  />
                )}
                <View style={styles.componentInfo}>
                  <ThemedText style={styles.componentItemName} numberOfLines={2}>
                    {item.name}
                  </ThemedText>
                  {item.sku && (
                    <ThemedText style={[styles.componentBrand, { fontSize: 11, opacity: 0.7 }]}>
                      SKU: {item.sku}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.componentPriceContainer}>
                  {item.price && (
                    <ThemedText style={styles.componentItemPrice}>
                      ${item.price.toFixed(2)}
                    </ThemedText>
                  )}
                  {!item.price && (
                    <ThemedText style={[styles.componentItemPrice, { opacity: 0.5 }]}>
                      See store
                    </ThemedText>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Ionicons name="cube-outline" size={48} color={colors.icon} />
                <ThemedText style={styles.emptyListText}>No components found</ThemedText>
                <ThemedText style={styles.emptyListSubtext}>
                  Try selecting a different store or check your internet connection
                </ThemedText>
              </View>
            }
          />
          )}
        </SafeAreaView>
      </Modal>

      {/* SKU Input Modal */}
      <Modal
        visible={showSkuModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSkuModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ThemedText type="subtitle">Enter SKU Number</ThemedText>
            <ThemedText style={[styles.skuModalSubtext, { color: colors.tabIconDefault, marginTop: 8, marginBottom: 16 }]}>
              Enter the SKU from the product page or price tag
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="e.g., 123456"
              placeholderTextColor={colors.tabIconDefault}
              value={manualSku}
              onChangeText={setManualSku}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => {
                  setShowSkuModal(false);
                  setManualSku('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
                onPress={handleAddManualSku}
              >
                <Text style={[styles.modalButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SKU Input Modal */}
      <Modal
        visible={showSkuModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSkuModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ThemedText type="subtitle">Enter SKU Number</ThemedText>
            <ThemedText style={[styles.skuModalSubtext, { color: colors.tabIconDefault, marginTop: 8, marginBottom: 16 }]}>
              Enter the SKU from the product page or price tag
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="e.g., 123456"
              placeholderTextColor={colors.tabIconDefault}
              value={manualSku}
              onChangeText={setManualSku}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => {
                  setShowSkuModal(false);
                  setManualSku('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
                onPress={handleAddManualSku}
              >
                <Text style={[styles.modalButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hidden WebView for scraping */}
      {scrapingCategory && (
        <View style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}>
          <WebView
            ref={webViewRef}
            source={{ uri: getCategoryURL(scrapingCategory, storeId) }}
            onLoadEnd={() => {
              console.log(`[PC Builder] WebView loaded for ${scrapingCategory}`);
              webViewRef.current?.injectJavaScript(getExtractionScript(scrapingCategory));
            }}
            onMessage={(event) => {
              handleWebViewMessage(event, scrapingCategory, (components) => {
                setAvailableComponents(components);
                setLoadingComponents(false);
                setScrapingCategory(null);
              });
            }}
            onError={(error) => {
              console.error('[PC Builder] WebView error:', error);
              setLoadingComponents(false);
              setScrapingCategory(null);
              Alert.alert('Error', 'Failed to load components from Microcenter');
            }}
          />
        </View>
      )}

      {/* Hidden WebView for scraping individual SKU by searching */}
      {scrapingSku && (
        <View style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}>
          <WebView
            ref={skuWebViewRef}
            source={{ uri: `https://www.microcenter.com/search/search_results.aspx?Ntt=${scrapingSku.sku}&myStore=true&storeid=${storeId}` }}
            onLoadEnd={() => {
              console.log(`[PC Builder SKU] WebView loaded, searching for SKU ${scrapingSku.sku}`);
              skuWebViewRef.current?.injectJavaScript(getExtractionScript('search'));
            }}
            onMessage={(event) => {
              console.log(`[PC Builder SKU] Received message from WebView`);
              handleWebViewMessage(event, 'search', async (components) => {
                console.log(`[PC Builder SKU] Found ${components.length} results for SKU ${scrapingSku.sku}`);
                
                // Find the exact SKU match
                const exactMatch = components.find(c => c.sku === scrapingSku.sku);
                
                if (exactMatch) {
                  console.log(`[PC Builder SKU] Found exact match:`, exactMatch);
                  // Update the loading component with real data
                  try {
                    const savedBuilds = await AsyncStorage.getItem('pcBuilds');
                    const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
                    const buildIndex = allBuilds.findIndex(b => b.id === currentBuildId);
                    
                    if (buildIndex !== -1) {
                      // Find and replace the loading component
                      const componentIndex = allBuilds[buildIndex].components?.findIndex(
                        c => c.sku === scrapingSku.sku && c.isLoading
                      );
                      
                      if (componentIndex !== -1) {
                        allBuilds[buildIndex].components[componentIndex] = {
                          ...exactMatch,
                          category_name: scrapingSku.category.name,
                          category_display: scrapingSku.category.display_name,
                        };
                        
                        await AsyncStorage.setItem('pcBuilds', JSON.stringify(allBuilds));
                        await loadCurrentBuild();
                        console.log(`[PC Builder SKU] Component updated successfully`);
                      }
                    }
                  } catch (error) {
                    console.error('[PC Builder SKU] Error updating component:', error);
                  }
                } else {
                  console.log(`[PC Builder SKU] No exact match found for SKU ${scrapingSku.sku}`);
                  Alert.alert('SKU Not Found', `Could not find product with SKU ${scrapingSku.sku} at this store.`);
                  // Remove the loading component silently
                  await removeComponent(scrapingSku.category.name, scrapingSku.sku);
                }
                
                setScrapingSku(null);
                setManualSku('');
              });
            }}
            onError={(error) => {
              console.error('[PC Builder SKU] WebView error searching for SKU:', error);
              Alert.alert('Error', 'Failed to search for product. Please try again.');
              removeComponent(scrapingSku.category.name, scrapingSku.sku);
              setScrapingSku(null);
            }}
          />
        </View>
      )}
      </ThemedView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  buildSelector: {
    maxHeight: 60,
    borderBottomWidth: 1,
  },
  buildSelectorContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  buildTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  buildTabText: {
    fontWeight: '600',
    fontSize: 14,
  },
  deleteBuildButton: {
    padding: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  totalPrice: {
    fontSize: 32,
    marginVertical: 8,
  },
  bundleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  bundleBadgeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requiredBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedComponent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  selectedComponentsContainer: {
    gap: 8,
  },
  multipleComponentItem: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  multipleIndicator: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  removeComponentButton: {
    padding: 4,
    marginLeft: 8,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    borderStyle: 'dashed',
  },
  addMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedComponentImage: {
    width: 50,
    height: 50,
    marginRight: 12,
    borderRadius: 4,
  },
  componentName: {
    fontSize: 14,
    marginBottom: 4,
  },
  componentPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  bundlePricingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  componentOriginalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  componentBundlePrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  originalTotalPrice: {
    fontSize: 20,
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 2,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 24,
    borderRadius: 16,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullModal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  componentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  componentImage: {
    width: 60,
    height: 60,
    marginRight: 12,
    borderRadius: 4,
  },
  componentInfo: {
    flex: 1,
    marginRight: 12,
  },
  componentItemName: {
    fontSize: 14,
    marginBottom: 4,
  },
  componentBrand: {
    fontSize: 12,
    opacity: 0.7,
  },
  componentPriceContainer: {
    alignItems: 'flex-end',
  },
  componentItemPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  componentOriginalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    marginTop: 64,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyListText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyListSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  bundleCard: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  bundleImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  bundleTypeSelector: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 24,
  },
  bundleTypeSelectorTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  bundleTypeButton: {
    width: '100%',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bundleTypeButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bundleTypeButtonSubtext: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
  },
  bundleTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  bundleName: {
    fontSize: 18,
    marginBottom: 8,
  },
  bundleDescription: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
  },
  bundlePricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bundleOriginalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  bundlePrice: {
    fontSize: 24,
  },
  savingsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  savingsText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  addBundleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addBundleButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  enterSkuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  enterSkuButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  skuModalSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
