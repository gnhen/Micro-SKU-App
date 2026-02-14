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
  const [showBundlesModal, setShowBundlesModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [availableBundles, setAvailableBundles] = useState([]);
  const [newBuildName, setNewBuildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('071');
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [scrapingCategory, setScrapingCategory] = useState(null);
  const webViewRef = useRef(null);

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
      
      // Load store ID from settings
      const savedStoreId = await AsyncStorage.getItem('storeId');
      if (savedStoreId) setStoreId(savedStoreId);
      
      // Load builds from AsyncStorage
      const savedBuilds = await AsyncStorage.getItem('pcBuilds');
      const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
      setBuilds(allBuilds);
      
      // Bundles fetching not yet implemented
      console.log('[PC Builder] Bundles fetching not yet implemented');
      
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
        // Calculate total price
        const totalPrice = build.components?.reduce((sum, c) => sum + (c.sale_price || c.price || 0), 0) || 0;
        setCurrentBuild({
          ...build,
          total_price: totalPrice,
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
      
      // Remove existing component in this category
      allBuilds[buildIndex].components = allBuilds[buildIndex].components?.filter(
        c => c.category_name !== selectedCategory.name
      ) || [];
      
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

  const handleRemoveComponent = async (categoryName) => {
    Alert.alert(
      'Remove Component',
      'Remove this component from your build?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const savedBuilds = await AsyncStorage.getItem('pcBuilds');
              const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
              const buildIndex = allBuilds.findIndex(b => b.id === currentBuildId);
              
              if (buildIndex !== -1) {
                allBuilds[buildIndex].components = allBuilds[buildIndex].components?.filter(
                  c => c.category_name !== categoryName
                ) || [];
                
                await AsyncStorage.setItem('pcBuilds', JSON.stringify(allBuilds));
                await loadCurrentBuild();
              }
            } catch (error) {
              console.error('Error removing component:', error);
              Alert.alert('Error', 'Failed to remove component');
            }
          },
        },
      ]
    );
  };

  const handleAddBundle = async (bundle) => {
    try {
      const savedBuilds = await AsyncStorage.getItem('pcBuilds');
      const allBuilds = savedBuilds ? JSON.parse(savedBuilds) : [];
      const buildIndex = allBuilds.findIndex(b => b.id === currentBuildId);
      
      if (buildIndex === -1) {
        throw new Error('Build not found');
      }
      
      // Add all components from bundle
      for (const component of bundle.components) {
        const category = categories.find(c => c.id === component.category_id);
        if (category) {
          const componentWithCategory = {
            ...component,
            category_name: category.name,
          };
          
          // Remove existing in this category
          allBuilds[buildIndex].components = allBuilds[buildIndex].components?.filter(
            c => c.category_name !== category.name
          ) || [];
          
          allBuilds[buildIndex].components.push(componentWithCategory);
        }
      }
      
      await AsyncStorage.setItem('pcBuilds', JSON.stringify(allBuilds));
      await loadCurrentBuild();
      setShowBundlesModal(false);
      Alert.alert('Success', 'Bundle added to your build!');
    } catch (error) {
      console.error('Error adding bundle:', error);
      Alert.alert('Error', 'Failed to add bundle');
    }
  };

  const getBuildComponentForCategory = (categoryName) => {
    return currentBuild?.components?.find(c => c.category_name === categoryName);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
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
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.tint }]}
              onPress={() => setShowBundlesModal(true)}
            >
              <Ionicons name="albums" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
              <Text style={[styles.headerButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Bundles</Text>
            </TouchableOpacity>
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
            <ThemedText type="title" style={styles.totalPrice}>
              ${currentBuild.total_price?.toFixed(2) || '0.00'}
            </ThemedText>
            {currentBuild.matchedBundles && currentBuild.matchedBundles.length > 0 && (
              <View style={[styles.bundleBadge, { backgroundColor: colors.notification }]}>
                <Ionicons name="pricetag" size={16} color="white" />
                <Text style={styles.bundleBadgeText}>
                  Bundle Detected! Save ${currentBuild.matchedBundles[0].savings?.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Component Categories */}
          {categories.map((category) => {
            const component = getBuildComponentForCategory(category.name);
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
                  </View>
                  {component && (
                    <TouchableOpacity onPress={() => handleRemoveComponent(category.name)}>
                      <Ionicons name="trash" size={20} color={colors.icon} />
                    </TouchableOpacity>
                  )}
                </View>

                {component ? (
                  <View style={styles.selectedComponent}>
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
                      <ThemedText style={styles.componentPrice}>
                        ${component.price?.toFixed(2) || 'N/A'}
                      </ThemedText>
                    </View>
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

      {/* Bundles Modal */}
      <Modal
        visible={showBundlesModal}
        animationType="slide"
        onRequestClose={() => setShowBundlesModal(false)}
      >
        <SafeAreaView style={[styles.fullModal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: 60 }]}>
            <ThemedText type="subtitle">Bundle & Save</ThemedText>
            <TouchableOpacity onPress={() => setShowBundlesModal(false)}>
              <Ionicons name="close" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={availableBundles}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={[styles.bundleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText type="defaultSemiBold" style={styles.bundleName}>
                  {item.name}
                </ThemedText>
                {item.description && (
                  <ThemedText style={styles.bundleDescription}>{item.description}</ThemedText>
                )}
                <View style={styles.bundlePricing}>
                  <View>
                    <Text style={[styles.bundleOriginalPrice, { color: colors.tabIconDefault }]}>
                      ${item.total_price?.toFixed(2)}
                    </Text>
                    <ThemedText type="defaultSemiBold" style={styles.bundlePrice}>
                      ${item.bundle_price?.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={[styles.savingsBadge, { backgroundColor: colors.notification }]}>
                    <Text style={styles.savingsText}>Save ${item.savings?.toFixed(2)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.addBundleButton, { backgroundColor: colors.tint, opacity: !currentBuildId ? 0.5 : 1 }]}
                  onPress={() => handleAddBundle(item)}
                  disabled={!currentBuildId}
                >
                  <Ionicons name="add-circle" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
                  <Text style={[styles.addBundleButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Add to Build</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Ionicons name="albums-outline" size={48} color={colors.icon} />
                <ThemedText style={styles.emptyListText}>No bundles available</ThemedText>
                <ThemedText style={styles.emptyListSubtext}>
                  Bundles will appear here once they're added to the database
                </ThemedText>
              </View>
            }
          />
        </SafeAreaView>
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
      </ThemedView>
    </SafeAreaView>
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
});
