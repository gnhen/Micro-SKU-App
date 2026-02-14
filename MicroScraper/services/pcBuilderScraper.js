/**
 * PC Builder Web Scraper for Mobile
 * Fetches component data directly from Microcenter's search pages
 * No database needed - uses the website as the source of truth
 */

// Cache duration: 30 minutes
const CACHE_DURATION = 30 * 60 * 1000;

let cachedData = {
  components: {},
  lastFetch: {},
};

/**
 * Check if cache is still valid for a category
 */
const isCacheValid = (categoryName) => {
  if (!cachedData.lastFetch[categoryName]) return false;
  return Date.now() - cachedData.lastFetch[categoryName] < CACHE_DURATION;
};

/**
 * Get standard PC Builder categories
 */
export const getCategories = () => {
  return [
    { id: 1, name: 'cpu', display_name: 'Processor (CPU)', order_index: 1, required: 1 },
    { id: 2, name: 'motherboard', display_name: 'Motherboard', order_index: 2, required: 1 },
    { id: 3, name: 'ram', display_name: 'Memory (RAM)', order_index: 3, required: 1 },
    { id: 4, name: 'gpu', display_name: 'Graphics Card', order_index: 4, required: 1 },
    { id: 5, name: 'storage', display_name: 'Storage', order_index: 5, required: 1 },
    { id: 6, name: 'psu', display_name: 'Power Supply', order_index: 6, required: 1 },
    { id: 7, name: 'case', display_name: 'Case', order_index: 7, required: 1 },
    { id: 8, name: 'cooler', display_name: 'CPU Cooler', order_index: 8, required: 0 },
    { id: 9, name: 'case_fans', display_name: 'Case Fans', order_index: 9, required: 0 },
    { id: 10, name: 'os', display_name: 'Operating System', order_index: 10, required: 0 },
  ];
};

/**
 * Fetch components for a specific category by scraping Microcenter
 */
export const fetchComponentsByCategory = async (categoryName, storeId = '071') => {
  const cacheKey = `${categoryName}_${storeId}`;
  
  if (isCacheValid(categoryName) && cachedData.components[cacheKey]) {
    console.log(`[PC Builder] Using cached ${categoryName} (${cachedData.components[cacheKey].length} items)`);
    return cachedData.components[cacheKey];
  }

  try {
    console.log(`[PC Builder] Fetching ${categoryName} from Microcenter (store ${storeId})...`);
    
    // Microcenter category search URLs
    const categoryUrls = {
      cpu: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294966995&myStore=true',
      motherboard: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294966996&myStore=true',
      ram: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294966965&myStore=true',
      gpu: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294966937&myStore=true',
      storage: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294945779&myStore=true',
      psu: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294966654&myStore=true',
      case: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294964318&myStore=true',
      cooler: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294966926&myStore=true',
      case_fans: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294966927&myStore=true',
      os: 'https://www.microcenter.com/search/search_results.aspx?Ntt=&prt=&N=4294967276&myStore=true',
    };

    const baseUrl = categoryUrls[categoryName];
    if (!baseUrl) {
      console.warn(`[PC Builder] No URL mapping for category: ${categoryName}`);
      return [];
    }

    const url = `${baseUrl}&storeid=${storeId}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const components = parseComponentsFromHTML(html, categoryName);
    
    cachedData.components[cacheKey] = components;
    cachedData.lastFetch[categoryName] = Date.now();
    
    console.log(`[PC Builder] Found ${components.length} ${categoryName} components`);
    return components;
    
  } catch (error) {
    console.error(`[PC Builder] Error fetching ${categoryName}:`, error.message);
    return [];
  }
};

/**
 * Parse component data from Microcenter search results HTML
 */
const parseComponentsFromHTML = (html, categoryName) => {
  const components = [];
  
  try {
    // Extract product list items - Microcenter uses data-id for SKU
    const productPattern = /<li[^>]*data-id="(\d+)"[^>]*class="product_wrapper"[^>]*>([\s\S]*?)<\/li>/g;
    let match;
    
    while ((match = productPattern.exec(html)) !== null) {
      const sku = match[1];
      const productHtml = match[2];
      
      try {
        // Extract product name
        const nameMatch = productHtml.match(/data-name="([^"]+)"/);
        const name = nameMatch ? decodeHTML(nameMatch[1]) : null;
        
        // Extract price (data-price is in dollars)
        const priceMatch = productHtml.match(/data-price="([0-9.]+)"/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : null;
        
        // Extract brand
        const brandMatch = productHtml.match(/data-brand="([^"]+)"/);
        const brand = brandMatch ? decodeHTML(brandMatch[1]) : null;
        
        // Extract sale price if available
        const salePriceMatch = productHtml.match(/class="price[^"]*"[^>]*>\s*\$([0-9,]+\.\d{2})/);
        const salePrice = salePriceMatch ? parseFloat(salePriceMatch[1].replace(/,/g, '')) : null;
        
        // Extract image - try multiple patterns
        let imageUrl = null;
        const imgMatch1 = productHtml.match(/data-src="([^"]+)"/);
        const imgMatch2 = productHtml.match(/src="(https:\/\/[^"]*product[^"]+)"/);
        if (imgMatch1) imageUrl = imgMatch1[1];
        else if (imgMatch2) imageUrl = imgMatch2[1];
        
        // Build proper image URL if we have SKU
        if (!imageUrl && sku) {
          imageUrl = `https://www.microcenter.com/product/images/${sku}_tn.jpg`;
        }
        
        if (sku && name && price !== null) {
          components.push({
            id: parseInt(sku),
            sku: sku,
            name: name,
            category_id: getCategoryId(categoryName),
            category_name: categoryName,
            brand: brand,
            price: price,
            sale_price: salePrice && salePrice < price ? salePrice : null,
            image_url: imageUrl,
            url: `https://www.microcenter.com/product/${sku}`,
            specs: {},
          });
        }
      } catch (e) {
        // Skip malformed products
        continue;
      }
    }
    
    // If no products found with the above pattern, try alternative
    if (components.length === 0) {
      const altPattern = /<a[^>]*href="\/product\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
      
      while ((match = altPattern.exec(html)) !== null) {
        const sku = match[1];
        const linkHtml = match[2];
        
        const nameMatch = linkHtml.match(/<h2[^>]*>([^<]+)<\/h2>/);
        const priceMatch = html.match(new RegExp(`data-id="${sku}"[^>]*data-price="([0-9.]+)"`));
        
        if (nameMatch && priceMatch) {
          components.push({
            id: parseInt(sku),
            sku: sku,
            name: decodeHTML(nameMatch[1].trim()),
            category_id: getCategoryId(categoryName),
            category_name: categoryName,
            brand: null,
            price: parseFloat(priceMatch[1]),
            sale_price: null,
            image_url: `https://www.microcenter.com/product/images/${sku}_tn.jpg`,
            url: `https://www.microcenter.com/product/${sku}`,
            specs: {},
          });
        }
      }
    }
  } catch (error) {
    console.error('[PC Builder] Error parsing HTML:', error.message);
  }
  
  return components;
};

/**
 * Get bundles (returns empty for now - would need bundle page scraping)
 */
export const fetchBundles = async () => {
  console.log('[PC Builder] Bundles fetching not yet implemented');
  return [];
};

/**
 * Helper: Get category ID from name
 */
const getCategoryId = (categoryName) => {
  const mapping = {
    cpu: 1,
    motherboard: 2,
    ram: 3,
    gpu: 4,
    storage: 5,
    psu: 6,
    case: 7,
    cooler: 8,
    case_fans: 9,
    os: 10,
  };
  return mapping[categoryName] || 0;
};

/**
 * Helper: Decode HTML entities
 */
const decodeHTML = (html) => {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™');
};

/**
 * Clear cache for a specific category or all
 */
export const clearCache = (categoryName = null) => {
  if (categoryName) {
    delete cachedData.components[categoryName];
    delete cachedData.lastFetch[categoryName];
    console.log(`[PC Builder] Cache cleared for ${categoryName}`);
  } else {
    cachedData = { components: {}, lastFetch: {} };
    console.log('[PC Builder] All cache cleared');
  }
};

/**
 * Simple compatibility filter (can be enhanced)
 */
export const filterCompatibleComponents = (components, existingComponents) => {
  // For now, return all components
  // Future: implement socket matching, RAM type, etc.
  return components;
};
