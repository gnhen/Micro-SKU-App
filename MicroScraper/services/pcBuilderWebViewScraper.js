/**
 * PC Builder Web Scraper using WebView
 * Scrapes Microcenter's PC Builder pages using WebView to handle JavaScript rendering
 */

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const componentCache = {};

/**
 * Category to Microcenter URL parameter mapping
 * Note: Some categories use search (Ntt) instead of N parameter due to Microcenter's category system changes
 */
const CATEGORY_URL_MAP = {
  // Core Components
  cpu: { N: '4294966995', name: 'Processors - Desktops' },
  gpu: { N: '4294966937', name: 'Video Cards' },
  motherboard: { N: '4294966996', name: 'Motherboards' },
  ram: { N: '4294966965', name: 'Memory' },
  storage: { N: '4294945779', name: 'Hard Drives' },
  psu: { N: '4294966654', name: 'Power Supplies' },
  case: { N: '4294964318', name: 'Computer Cases' },
  cpuCooler: { N: '4294966927', name: 'CPU Cooling' },
  // Software (using search)
  os: { N: '4294967276', name: 'Operating Systems' },
  antivirus: { useSearch: true, searchTerm: 'antivirus software', name: 'Antivirus Software' },
  office: { useSearch: true, searchTerm: 'microsoft office', name: 'Office Software' },
  // Peripherals
  keyboard: { N: '4294966800', name: 'Wired & Wireless Keyboards' },
  mouse: { N: '4294966799', name: 'Wired & Wireless Mice' },
  mousePad: { useSearch: true, searchTerm: 'gaming mouse pad', name: 'Gaming Mouse Pads' },
  speakers: { useSearch: true, searchTerm: 'computer speakers', name: 'Computer Speakers' },
  headset: { N: '4294853406', name: 'Gaming Headsets' },
  monitor: { N: '4294966896', name: 'Monitors' },
  videoCapture: { useSearch: true, searchTerm: 'video capture card', name: 'Capture Cards' },
  opticalDrive: { useSearch: true, searchTerm: 'internal optical drive dvd blu-ray', name: 'Optical Drives' },
  router: { N: '4294966869', name: 'Wireless Routers' },
  printer: { useSearch: true, searchTerm: 'printer', name: 'Printers' },
  // Accessories
  fans: { N: '4294966926', name: 'Case Fans' },
  lighting: { useSearch: true, searchTerm: 'case lighting', name: 'Case Lighting' },
  cables: { useSearch: true, searchTerm: 'computer cables adapters', name: 'Computer Cables' },
  ups: { useSearch: true, searchTerm: 'ups battery backup', name: 'UPS Battery Backup' },
  usb: { useSearch: true, searchTerm: 'usb flash drive', name: 'USB Flash Drives' },
};

/**
 * Get the Microcenter search URL for a category
 */
export function getCategoryURL(category, storeId = '071') {
  const categoryData = CATEGORY_URL_MAP[category];
  if (!categoryData) {
    console.warn(`[PC Builder WebView] Unknown category: ${category}`);
    return null;
  }
  
  // Use search query if specified (for categories where N parameter doesn't work reliably)
  if (categoryData.useSearch && categoryData.searchTerm) {
    const encodedSearch = encodeURIComponent(categoryData.searchTerm);
    return `https://www.microcenter.com/search/search_results.aspx?Ntt=${encodedSearch}&myStore=true&storeid=${storeId}`;
  }
  
  // Use N parameter for traditional category browsing
  return `https://www.microcenter.com/search/search_results.aspx?N=${categoryData.N}&myStore=true&storeid=${storeId}`;
}

/**
 * Get the JavaScript code to inject into the WebView for scraping
 */
export function getExtractionScript(category) {
  return `
(function() {
  try {
    const products = [];
    
    // Method 1: Look for product articles/list items in Microcenter's structure
    const productElements = document.querySelectorAll('article.product_wrapper, li.product_wrapper, div.product_wrapper, [data-id], article');
    
    console.log('Found ' + productElements.length + ' potential product elements');
    
    productElements.forEach(element => {
      try {
        // Extract SKU - look for "SKU: XXXXXX" pattern in text first
        let sku = null;
        const skuText = element.textContent.match(/SKU[:\s#]+([0-9]{6})/i);
        if (skuText) {
          sku = skuText[1];
        }
        
        // Fallback to data-id if no SKU found in text
        if (!sku) {
          sku = element.getAttribute('data-id');
          if (!sku) {
            const skuElement = element.querySelector('[data-id]');
            if (skuElement) sku = skuElement.getAttribute('data-id');
          }
        }
        
        // Extract product name and brand
        let name = null;
        let brand = null;
        
        // Try to get full product name with brand
        const nameSelectors = [
          'h2 a[data-name]',
          'a[data-name]',
          'h2 a',
          '.product-title',
          '.product_name',
          'a[href*="/product/"]'
        ];
        
        for (const selector of nameSelectors) {
          const nameElement = element.querySelector(selector);
          if (nameElement) {
            const fullName = nameElement.getAttribute('data-name') || nameElement.textContent?.trim();
            if (fullName) {
              name = fullName;
              // Extract brand from the name if present
              const brandMatch = fullName.match(/^(AMD|Intel|NVIDIA|MSI|ASUS|Gigabyte|ASRock|Corsair|G\.Skill|Samsung|Western Digital|Seagate|EVGA|Cooler Master|NZXT|Thermaltake|be quiet!|Fractal Design|Lian Li|Seasonic|Crucial|Kingston)\s+/i);
              if (brandMatch) {
                brand = brandMatch[1];
              }
              break;
            }
          }
        }
        
        // Extract price - look for data-price attribute first
        let price = null;
        const priceElement = element.querySelector('[data-price]');
        if (priceElement) {
          const priceValue = priceElement.getAttribute('data-price');
          if (priceValue) {
            price = parseFloat(priceValue);
          }
        }
        
        // Fallback: search for price in text, but require decimal format to avoid SKUs
        if (!price) {
          // Match prices like $999.99 or $1,999.99 (must have decimal)
          const priceText = element.textContent.match(/\$([0-9]{1,4},[0-9]{3}\.[0-9]{2}|[0-9]{1,4}\.[0-9]{2})/);
          if (priceText) {
            const cleanPrice = priceText[1].replace(/,/g, '');
            const parsed = parseFloat(cleanPrice);
            // Sanity check: price should be reasonable
            if (parsed >= 10 && parsed <= 10000) {
              price = parsed;
            }
          }
        }
        
        // Extract image
        let image = null;
        const imgElement = element.querySelector('img[data-src], img[src]');
        if (imgElement) {
          image = imgElement.getAttribute('data-src') || imgElement.getAttribute('src');
          // Make sure it's a full URL
          if (image && image.startsWith('/')) {
            image = 'https://www.microcenter.com' + image;
          }
        }
        
        // Extract product URL
        let url = null;
        const linkElement = element.querySelector('a[href*="/product/"]');
        if (linkElement) {
          url = linkElement.href;
        }
        
        // Only add if we have at least SKU and name, and SKU/name is not 'Banner'
        if (sku && name && name.length > 3 && 
            sku.toLowerCase() !== 'banner' && 
            !name.toLowerCase().includes('banner')) {
          products.push({
            sku,
            name,
            brand,
            price,
            image,
            url,
            category: '${category}',
          });
        }
      } catch (err) {
        console.log('Error parsing product element:', err);
      }
    });
    
    // Method 2: Try to extract from inline JavaScript data
    if (products.length === 0) {
      // Look for window.products or similar data structures
      if (window.products && Array.isArray(window.products)) {
        window.products.forEach(p => {
          products.push({
            sku: p.id || p.sku || p.productId,
            name: p.name || p.title,
            price: p.price ? parseFloat(p.price) : null,
            url: p.url || p.link,
            category: '${category}',
          });
        });
      } else if (window.productData && Array.isArray(window.productData)) {
        window.productData.forEach(p => {
          products.push({
            sku: p.id || p.sku || p.productId,
            name: p.name || p.title,
            price: p.price ? parseFloat(p.price) : null,
            url: p.url || p.link,
            category: '${category}',
          });
        });
      }
    }
    
    // Method 3: Scrape from visible text patterns
    if (products.length === 0) {
      const allText = document.body.innerHTML;
      
      // Find all SKU patterns
      const skuMatches = allText.matchAll(/SKU[:\\s]+([0-9]{6})/gi);
      for (const match of skuMatches) {
        const sku = match[1];
        
        // Try to find nearby product name and price
        const contextStart = Math.max(0, match.index - 500);
        const contextEnd = Math.min(allText.length, match.index + 500);
        const context = allText.substring(contextStart, contextEnd);
        
        // Extract price
        const priceMatch = context.match(/\\$([0-9,]+\\.[0-9]{2})/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
        
        // Extract product link/name
        const linkMatch = context.match(/<a[^>]*href="(\\/product\\/[^"]+)"[^>]*>([^<]+)<\\/a>/i);
        if (linkMatch) {
          products.push({
            sku,
            name: linkMatch[2].trim(),
            price,
            url: 'https://www.microcenter.com' + linkMatch[1],
            category: '${category}',
          });
        }
      }
    }
    
    // Send results back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      success: true,
      category: '${category}',
      count: products.length,
      products: products,
    }));
    
  } catch (error) {
    console.log('Extraction error: ' + error.message);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      success: false,
      category: '${category}',
      error: error.message,
    }));
  }
})();
true; // Required for iOS
`;
}

/**
 * Handle message received from WebView
 */
export function handleWebViewMessage(event, category, callback) {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    
    if (!data.success) {
      console.error(`[PC Builder WebView] Error scraping ${category}:`, data.error);
      callback([]);
      return;
    }
    
    console.log(`[PC Builder WebView] Found ${data.count} ${category} components`);
    
    // Cache the results
    componentCache[category] = {
      data: data.products,
      timestamp: Date.now(),
    };
    
    // Return the components
    callback(data.products);
    
  } catch (error) {
    console.error('[PC Builder WebView] Error parsing message:', error);
    callback([]);
  }
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(category) {
  const cached = componentCache[category];
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_DURATION;
}

/**
 * Get cached components or return null if cache is invalid
 */
export function getCachedComponents(category) {
  if (isCacheValid(category)) {
    console.log(`[PC Builder WebView] Using cached ${category} components`);
    return componentCache[category].data;
  }
  return null;
}

/**
 * Get list of available categories organized by sections
 */
export function getCategories() {
  return [
    {
      section: 'Core Components',
      categories: [
        { id: 'cpu', name: 'cpu', display_name: 'CPU', icon: 'cpu-chip', allowMultiple: false },
        { id: 'gpu', name: 'gpu', display_name: 'GPU', icon: 'layers', allowMultiple: true },
        { id: 'motherboard', name: 'motherboard', display_name: 'Motherboard', icon: 'grid', allowMultiple: false },
        { id: 'ram', name: 'ram', display_name: 'RAM', icon: 'memory', allowMultiple: true },
        { id: 'storage', name: 'storage', display_name: 'Storage', icon: 'save', allowMultiple: true },
        { id: 'psu', name: 'psu', display_name: 'Power Supply', icon: 'flash', allowMultiple: false },
        { id: 'case', name: 'case', display_name: 'Case', icon: 'cube', allowMultiple: false },
        { id: 'cpuCooler', name: 'cpuCooler', display_name: 'CPU Cooler', icon: 'snow', allowMultiple: false },
      ],
    },
    {
      section: 'Software',
      categories: [
        { id: 'os', name: 'os', display_name: 'Operating System', icon: 'desktop', allowMultiple: false },
        { id: 'antivirus', name: 'antivirus', display_name: 'Antivirus Software', icon: 'shield', allowMultiple: false },
        { id: 'office', name: 'office', display_name: 'Office Suites', icon: 'document-text', allowMultiple: false },
      ],
    },
    {
      section: 'Peripherals',
      categories: [
        { id: 'keyboard', name: 'keyboard', display_name: 'Keyboard', icon: 'keypad', allowMultiple: false },
        { id: 'mouse', name: 'mouse', display_name: 'Mouse', icon: 'hand-left', allowMultiple: false },
        { id: 'mousePad', name: 'mousePad', display_name: 'Mouse Pad', icon: 'tablet-landscape', allowMultiple: false },
        { id: 'speakers', name: 'speakers', display_name: 'Speakers', icon: 'volume-high', allowMultiple: false },
        { id: 'headset', name: 'headset', display_name: 'Headset', icon: 'headset', allowMultiple: false },
        { id: 'monitor', name: 'monitor', display_name: 'Monitor', icon: 'tv', allowMultiple: true },
        { id: 'videoCapture', name: 'videoCapture', display_name: 'Video Capture', icon: 'videocam', allowMultiple: false },
        { id: 'opticalDrive', name: 'opticalDrive', display_name: 'Optical Drive', icon: 'disc', allowMultiple: true },
        { id: 'router', name: 'router', display_name: 'Wireless Router', icon: 'wifi', allowMultiple: false },
        { id: 'printer', name: 'printer', display_name: 'Printer', icon: 'print', allowMultiple: false },
      ],
    },
    {
      section: 'Accessories',
      categories: [
        { id: 'fans', name: 'fans', display_name: 'Case Fans', icon: 'sync', allowMultiple: true },
        { id: 'lighting', name: 'lighting', display_name: 'Case Lighting', icon: 'bulb', allowMultiple: true },
        { id: 'cables', name: 'cables', display_name: 'Cables & Adapters', icon: 'git-branch', allowMultiple: true },
        { id: 'ups', name: 'ups', display_name: 'Surge & UPS', icon: 'battery-charging', allowMultiple: false },
        { id: 'usb', name: 'usb', display_name: 'USB Flash Drives', icon: 'hardware-chip', allowMultiple: true },
      ],
    },
  ];
}

/**
 * Clear all cached data
 */
export function clearCache() {
  Object.keys(componentCache).forEach(key => delete componentCache[key]);
  console.log('[PC Builder WebView] Cache cleared');
}
