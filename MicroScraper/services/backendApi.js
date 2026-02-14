/**
 * Backend API Service
 * Integrates with the Node.js scraper backend to fetch component and bundle data
 */

// Configure this to your backend server IP/URL
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000'  // Development (use your computer's IP for real devices)
  : 'https://your-backend-url.com';  // Production

/**
 * Fetch all component categories from backend
 */
export const fetchCategories = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

/**
 * Fetch all bundles from backend
 */
export const fetchBundles = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bundles`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.bundles;
  } catch (error) {
    console.error('Error fetching bundles:', error);
    throw error;
  }
};

/**
 * Fetch detailed component data by SKU
 */
export const fetchComponentBySku = async (sku) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/component/${sku}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.component;
  } catch (error) {
    console.error(`Error fetching component ${sku}:`, error);
    throw error;
  }
};

/**
 * Fetch compatibility rules from backend
 */
export const fetchCompatibilityRules = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/compatibility`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.compatibilityData;
  } catch (error) {
    console.error('Error fetching compatibility rules:', error);
    throw error;
  }
};

/**
 * Request backend to refresh all data
 */
export const refreshBackendData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/refresh`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error refreshing backend data:', error);
    throw error;
  }
};

/**
 * Get backend statistics
 */
export const fetchBackendStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching backend stats:', error);
    throw error;
  }
};

/**
 * Parse price string to number
 */
export const parsePrice = (priceString) => {
  if (!priceString) return 0;
  const cleaned = priceString.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
};

/**
 * Sync bundles from backend to local database
 */
export const syncBundlesFromBackend = async (addBundle, addComponent) => {
  try {
    const bundles = await fetchBundles();
    const syncedBundles = [];

    for (const bundle of bundles) {
      const componentSkus = [];

      // Add each component to the database first
      for (const component of bundle.components || []) {
        if (component.sku) {
          try {
            // Fetch full component details
            const fullComponent = await fetchComponentBySku(component.sku);
            
            // Add to database
            await addComponent({
              sku: component.sku,
              name: fullComponent.name || component.name,
              category: inferCategoryFromName(fullComponent.name || component.name),
              brand: fullComponent.brand,
              price: parsePrice(fullComponent.price),
              sale_price: null,
              image_url: fullComponent.imageUrl,
              url: `https://www.microcenter.com/product/${component.sku}`,
              specs: fullComponent.specs || {},
            });

            componentSkus.push(component.sku);
          } catch (error) {
            console.warn(`Could not fetch component ${component.sku}:`, error);
          }
        }
      }

      // Add bundle to database
      const bundleId = await addBundle({
        name: bundle.name,
        description: bundle.description,
        total_price: parsePrice(bundle.totalPrice),
        bundle_price: parsePrice(bundle.bundlePrice),
        savings: parsePrice(bundle.totalPrice) - parsePrice(bundle.bundlePrice),
        url: bundle.url || '',
      }, componentSkus);

      syncedBundles.push(bundleId);
    }

    return syncedBundles;
  } catch (error) {
    console.error('Error syncing bundles from backend:', error);
    throw error;
  }
};

/**
 * Infer component category from product name (basic heuristic)
 */
const inferCategoryFromName = (name) => {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('intel') || nameLower.includes('amd') || nameLower.includes('processor') || nameLower.includes('cpu')) {
    return 'cpu';
  }
  if (nameLower.includes('motherboard') || nameLower.includes('mainboard')) {
    return 'motherboard';
  }
  if (nameLower.includes('memory') || nameLower.includes('ram') || nameLower.includes('ddr')) {
    return 'ram';
  }
  if (nameLower.includes('geforce') || nameLower.includes('radeon') || nameLower.includes('graphics')) {
    return 'gpu';
  }
  if (nameLower.includes('ssd') || nameLower.includes('nvme') || nameLower.includes('hard drive') || nameLower.includes('hdd')) {
    return 'storage';
  }
  if (nameLower.includes('power supply') || nameLower.includes('psu')) {
    return 'psu';
  }
  if (nameLower.includes('case') && !nameLower.includes('fan')) {
    return 'case';
  }
  if (nameLower.includes('cooler') || nameLower.includes('cooling')) {
    return 'cooler';
  }
  if (nameLower.includes('fan')) {
    return 'case_fans';
  }
  if (nameLower.includes('windows') || nameLower.includes('operating system') || nameLower.includes('os')) {
    return 'os';
  }
  
  return 'other';
};

export default {
  fetchCategories,
  fetchBundles,
  fetchComponentBySku,
  fetchCompatibilityRules,
  refreshBackendData,
  fetchBackendStats,
  syncBundlesFromBackend,
  parsePrice,
};
