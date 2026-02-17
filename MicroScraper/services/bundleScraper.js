/**
 * Bundle Scraper for Microcenter
 * Fetches bundle information from Microcenter's bundle pages
 */

/**
 * Get the JavaScript code to inject into WebView for scraping bundle data
 */
export function getBundleExtractionScript() {
  return `
(function() {
  try {
    console.log('[Bundle Scraper] =====  STARTING EXTRACTION =====');
    console.log('[Bundle Scraper] Page URL:', window.location.href);
    console.log('[Bundle Scraper] Page title:', document.title);
    console.log('[Bundle Scraper] Page ready state:', document.readyState);
    
    // Debug: Check what's on the page
    console.log('[Bundle Scraper] Body HTML length:', document.body.innerHTML.length);
    console.log('[Bundle Scraper] First 500 chars:', document.body.textContent.substring(0, 500));
    
    const bundles = [];
    
    // Find all product links that contain bundle IDs (pattern: /product/XXXXXXX/)
    const allLinks = Array.from(document.querySelectorAll('a[href*="/product/"]'));
    console.log('[Bundle Scraper] Found ' + allLinks.length + ' product links total');
    
    if (allLinks.length > 0) {
      console.log('[Bundle Scraper] Sample link href:', allLinks[0].href);
      console.log('[Bundle Scraper] Sample link text:', allLinks[0].textContent.substring(0, 100));
    }
    
    // Count links by product ID prefix
    const idCounts = { '500': 0, '600': 0, '700': 0, '800': 0, '900': 0, 'other': 0 };
    allLinks.forEach(link => {
      const match = link.href.match(/\\/product\\/(\\d+)\\//);
      if (match) {
        const id = match[1];
        const prefix = id.substring(0, 3);
        if (idCounts[prefix] !== undefined) idCounts[prefix]++;
        else idCounts['other']++;
      }
    });
    console.log('[Bundle Scraper] Product ID prefixes:', JSON.stringify(idCounts));
    
    // Map to track unique bundles
    const uniqueBundles = new Map();
    
    allLinks.forEach((link, idx) => {
      try {
        const href = link.href;
        const match = href.match(/\\/product\\/(\\d+)\\//);
        if (!match) return;
        
        const productId = match[1];
        
        // Bundles have product IDs starting with 500
        if (!productId.startsWith('500')) return;
        
        // Skip if already processed
        if (uniqueBundles.has(productId)) return;
        
        if (idx < 5) { // Log first few bundles
          console.log('[Bundle Scraper] Processing bundle:', productId);
        }
        
        // Extract bundle name from link text
        let bundleName = link.textContent.trim();
        if (!bundleName || bundleName.length < 3) {
          bundleName = 'Bundle ' + productId;
        }
        
        // Find the container for this bundle
        const container = link.closest('div, section, article');
        if (!container) {
          console.log('[Bundle Scraper] No container found for', productId);
          return;
        }
        
        const containerText = container.textContent;
        
        // Extract image URL
        let imageUrl = null;
        const imgElement = container.querySelector('img');
        if (imgElement) {
          imageUrl = imgElement.src || imgElement.getAttribute('data-src');
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = 'https://www.microcenter.com' + imageUrl;
          }
        }
        
        // Extract pricing - look for patterns like "REG. $624.97 SAVE $274.98 $349.99"
        let originalPrice = null;
        let bundlePrice = null;
        let savings = null;
        
        // Match "SAVE $XXX.XX"
        const savingsMatch = containerText.match(/SAVE\\s+\\$\\s?([0-9,]+\\.\\d{2})/i);
        if (savingsMatch) {
          savings = parseFloat(savingsMatch[1].replace(/,/g, ''));
        }
        
        // Match "REG. $XXX.XX" or "BUNDLE: REG. $XXX.XX"
        const regMatch = containerText.match(/REG\\.?\\s+\\$\\s?([0-9,]+\\.\\d{2})/i);
        if (regMatch) {
          originalPrice = parseFloat(regMatch[1].replace(/,/g, ''));
        }
        
        // Find all prices in container
        const priceMatches = containerText.match(/\\$\\s?([0-9,]+\\.\\d{2})/g);
        if (priceMatches && priceMatches.length > 0) {
          const prices = priceMatches.map(p => parseFloat(p.replace(/[\\$,\\s]/g, '')));
          
          // The bundle price is usually the last/smallest price shown
          bundlePrice = Math.min(...prices);
          
          // If we have savings but no original price, calculate it
          if (savings && !originalPrice) {
            originalPrice = bundlePrice + savings;
          }
          // If we have original price but no savings, calculate it
          if (originalPrice && !savings) {
            savings = originalPrice - bundlePrice;
          }
        }
        
        // Extract component SKUs - format: "774919 $429.99 / 865840 $294.99 / 440792 $449.99"
        const components = [];
        const skuMatches = containerText.matchAll(/(\\d{6})\\s+\\$\\s?([0-9,]+\\.\\d{2})/g);
        for (const skuMatch of skuMatches) {
          const sku = skuMatch[1];
          const price = parseFloat(skuMatch[2].replace(/,/g, ''));
          
          // Try to extract component name from container HTML
          let componentName = '';
          
          // Look for the SKU in the HTML and try to find associated product name
          const skuIndex = containerText.indexOf(sku);
          if (skuIndex > 50) {
            // Get text before SKU - product names usually appear before
            const textBefore = containerText.substring(Math.max(0, skuIndex - 300), skuIndex);
            
            // Split by common delimiters and get the last meaningful chunk
            const parts = textBefore.split(/[\\n\\r]+/);
            
            // Look backwards for a line that looks like a product name
            for (let i = parts.length - 1; i >= 0; i--) {
              const part = parts[i].trim();
              
              // Product names typically:
              // - Are 15-100 characters
              // - Contain alphanumeric and spaces
              // - Don't start with $ or numbers
              // - Don't contain SAVE, BUNDLE, REG keywords
              if (part.length >= 15 && 
                  part.length <= 100 && 
                  /[A-Za-z]/.test(part) &&
                  !/^[\\$\\d]/.test(part) &&
                  !/SAVE|BUNDLE|REG\\.|Price|Store/i.test(part)) {
                componentName = part;
                break;
              }
            }
            
            // If no name found, try looking for brand names
            if (!componentName) {
              const brandMatch = textBefore.match(/(AMD|Intel|MSI|ASUS|Gigabyte|ASRock|G\\.?Skill|Corsair|Kingston)\\s+[A-Za-z0-9\\s-]{5,80}$/i);
              if (brandMatch) {
                componentName = brandMatch[0].trim();
              }
            }
          }
          
          // Avoid duplicates
          if (!components.find(c => c.sku === sku)) {
            components.push({
              sku: sku,
              name: componentName || '',
              price: price,
              category: null,
            });
            
            if (idx < 5) {
              console.log('[Bundle Scraper] SKU:', sku, 'Name:', componentName || 'NOT FOUND', 'Price:', price);
            }
          }
        }
        
        // Only add bundle if we have useful data
        if (bundleName && (bundlePrice || components.length > 0)) {
          const bundle = {
            id: productId,
            name: bundleName,
            description: null,
            savings: savings || 0,
            originalPrice: originalPrice,
            bundlePrice: bundlePrice,
            total_price: originalPrice, // Alias for compatibility
            bundle_price: bundlePrice,  // Alias for compatibility
            url: href,
            image: imageUrl,
            components: components,
          };
          
          uniqueBundles.set(productId, bundle);
          if (idx < 3) { // Log first few
            console.log('[Bundle Scraper] Added bundle:', productId, '-', bundleName, '(' + components.length + ' components)');
          }
        }
      } catch (err) {
        console.log('[Bundle Scraper] Error processing link:', err.message);
      }
    });
    
    const bundlesArray = Array.from(uniqueBundles.values());
    console.log('[Bundle Scraper] ===== EXTRACTION COMPLETE =====');
    console.log('[Bundle Scraper] Total bundles:', bundlesArray.length);
    
    // Send results back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      success: true,
      type: 'bundles',
      bundles: bundlesArray,
      count: bundlesArray.length,
    }));
    
  } catch (error) {
    console.log('[Bundle Scraper] FATAL ERROR:', error.message);
    console.log('[Bundle Scraper] Stack:', error.stack);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      success: false,
      type: 'bundles',
      error: error.message,
      bundles: [],
    }));
  }
})();
true;
`;
}

/**
 * Get the Microcenter bundle page URL
 */
export function getMicrocenterBundleURL(storeId = '071', type = 'amd') {
  const baseUrl = type === 'intel' 
    ? 'https://www.microcenter.com/site/content/intel-bundle-and-save.aspx'
    : 'https://www.microcenter.com/site/content/bundle-and-save.aspx';
  return `${baseUrl}?storeid=${storeId}`;
}

/**
 * Parse bundle data from WebView message
 */
export function parseBundleMessage(event) {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'bundles') {
      return data;
    }
    return null;
  } catch (error) {
    console.error('[Bundle Scraper] Failed to parse message:', error);
    return null;
  }
}
