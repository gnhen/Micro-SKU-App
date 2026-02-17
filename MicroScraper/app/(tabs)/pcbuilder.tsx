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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [newBuildName, setNewBuildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('071');
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [scrapingCategory, setScrapingCategory] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
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
      
      // Initialize all sections as expanded
      const initialExpanded = {};
      cats.forEach(section => {
        initialExpanded[section.section] = true;
      });
      setExpandedSections(initialExpanded);
      
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
          return sum + price;
        }, 0) || 0;
        
        // Calculate original price for comparison
        const originalTotalPrice = build.components?.reduce((sum, c) => {
          const price = c.originalPrice || c.sale_price || c.price || 0;
          return sum + price;
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
          },
        },
      ]
    );
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
                onPress={() => Alert.alert('Share', 'Share functionality coming soon!')}
              >
                <Ionicons name="share-social" size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
                <Text style={[styles.headerButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>Share</Text>
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
                              ${component.price?.toFixed(2) || 'N/A'}
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
});
