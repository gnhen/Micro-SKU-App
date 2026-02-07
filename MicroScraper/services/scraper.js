const BASE_URL = 'https://www.microcenter.com';

const decodeHtml = (html) => {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

const extractReviews = (html) => {
  // Extract star rating and review count from JSON-LD structured data
  let rating = 0;
  let reviewCount = 0;
  
  // Look for aggregateRating in JSON-LD
  const aggregateMatch = html.match(/"aggregateRating"\s*:\s*{[^}]*"ratingValue"\s*:\s*"([0-9.]+)"[^}]*"reviewCount"\s*:\s*"(\d+)"/i);
  if (aggregateMatch) {
    rating = parseFloat(aggregateMatch[1]);
    reviewCount = parseInt(aggregateMatch[2], 10);
  }
  
  // Fallback: try separate patterns
  if (rating === 0) {
    const ratingMatch = html.match(/"ratingValue"\s*:\s*"([0-9.]+)"/);
    if (ratingMatch && ratingMatch[1]) {
      rating = parseFloat(ratingMatch[1]);
    }
  }
  
  if (reviewCount === 0) {
    const countMatch = html.match(/"reviewCount"\s*:\s*"(\d+)"/);
    if (countMatch && countMatch[1]) {
      reviewCount = parseInt(countMatch[1], 10);
    }
  }

  console.log('Extracted reviews:', { rating, reviewCount });
  return { rating, reviewCount };
};

const extractProInstallation = (html) => {
  const installations = [];
  
  // Pattern: Graphics Card Installation Service - $59.99
  const installPattern = /data-name="([^"]*Installation Service[^"]*)"[^>]*data-price="([0-9.]+)"/gi;
  let match;
  
  while ((match = installPattern.exec(html)) !== null) {
    const name = decodeHtml(match[1]);
    const price = parseFloat(match[2]);
    installations.push({ name, price });
  }
  
  console.log('Extracted installations:', installations);
  return installations;
};

const extractProtectionPlans = (html) => {
  const plans = [];
  
  // Catch-all pattern from radio buttons - captures full plan names with details
  const radioPattern = /data-name="(\d+\s*Year[^"]*Plan[^"]*)"[^>]*data-price\s*="([0-9.]+)"/gi;
  let match;
  
  while ((match = radioPattern.exec(html)) !== null) {
    const name = decodeHtml(match[1]);
    const price = parseFloat(match[2]);
    // Avoid duplicates
    if (!plans.some(p => p.name === name && p.price === price)) {
      plans.push({ name, price });
    }
  }
  
  console.log('Extracted protection plans:', plans);
  return plans;
};

const extractLocation = (html) => {
  // Pattern: <span>Located In Aisle 3<span class="otherLocation">, Aisle 3B Endcap</span></span>
  const locationMatch = html.match(/<span>Located In ([^<]+)(?:<span[^>]*class=['"][^'"]*otherLocation[^'"]*['"][^>]*>([^<]+)<\/span>)?<\/span>/i);
  if (locationMatch) {
    let location = locationMatch[1].trim();
    if (locationMatch[2]) {
      location += locationMatch[2].trim();
    }
    console.log('Extracted location:', location);
    return location;
  }
  console.log('No location found');
  return null;
};

const extractStock = (html, storeId) => {
  let stockText = null;
  let stock = 0;
  let inStock = false;
  
  // Pattern: <span class="inventoryCnt">25+ <span class="msgInStock">NEW IN STOCK</span></span><span class="storeName"> at Sharonville Store</span>
  const stockMatch = html.match(/<span[^>]*class=['"][^'"]*inventoryCnt[^'"]*['"][^>]*>([\s\S]*?)<\/span><span[^>]*class=['"][^'"]*storeName[^'"]*['"][^>]*>([^<]+)<\/span>/i);
  if (stockMatch) {
    // Remove nested HTML tags from count text
    let countText = stockMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract number for display (just "25+" or "0-24")
    const numMatch = countText.match(/(\d+)\+?/);
    if (numMatch) {
      stock = parseInt(numMatch[1], 10);
      inStock = true;
      // Show "25+ in Stock" or "5 in Stock"
      if (countText.includes('+')) {
        stockText = numMatch[1] + '+ in Stock';
      } else {
        stockText = numMatch[1] + ' in Stock';
      }
    }
    
    // Check for "IN STOCK" or "OUT OF STOCK"
    if (countText.match(/in\s*stock/i)) {
      inStock = true;
      if (stock === 0) {
        stock = 1;
        stockText = '1 in Stock';
      }
    } else if (countText.match(/out\s*of\s*stock/i)) {
      inStock = false;
      stock = 0;
      stockText = '0 in Stock';
    }
  }
  
  console.log('Extracted stock:', { stockText, stock, inStock });
  console.log('Stock match details:', stockMatch ? 'Pattern matched' : 'Pattern did not match');
  return { stockText, stock, inStock };
};

const extractSpecsFromFeatures = (html) => {
  const specs = [];
  
  // Extract from z_features JSON (contains all structured specs)
  const zFeaturesMatch = html.match(/"z_features"\s*:\s*"([^"]+)"/);
  if (zFeaturesMatch && zFeaturesMatch[1]) {
    const featuresString = zFeaturesMatch[1];
    // Parse format: Group:group_name, Feature:feature_name, Value:feature_value | ...
    const featurePairs = featuresString.split(' | ');
    
    featurePairs.forEach(pair => {
      const groupMatch = pair.match(/Group:([^,]+)/);
      const featureMatch = pair.match(/Feature:([^,]+)/);
      const valueMatch = pair.match(/Value:(.+)/);
      
      if (featureMatch && valueMatch) {
        const group = groupMatch ? groupMatch[1].replace(/_/g, ' ') : '';
        const feature = featureMatch[1].replace(/_/g, ' ');
        const value = valueMatch[1].replace(/\\/g, '');
        
        // Capitalize first letter
        const formattedFeature = feature.charAt(0).toUpperCase() + feature.slice(1);
        const formattedGroup = group.charAt(0).toUpperCase() + group.slice(1);
        
        specs.push({ 
          label: formattedFeature, 
          value: value,
          group: formattedGroup
        });
      }
    });
  }
  
  return specs;
};

const extractSpecs = (html) => {
  const specs = [];
  
  // Extract SKU, Mfr Part#, UPC from the overview section
  // Pattern: <strong class="lbl">Label:</strong><span class="item">Value</span>
  const infoPattern = /<strong[^>]*class=['"]lbl['"][^>]*>([^<]+)<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/gi;
  let match;
  
  while ((match = infoPattern.exec(html)) !== null) {
    const label = decodeHtml(match[1]).replace(':', '');
    const value = decodeHtml(match[2]);
    if (label && value) {
      specs.push({ label, value });
    }
  }

  // Extract features from bullet list
  // Pattern: <li>:marker " feature text"</li>
  const featurePattern = /<li[^>]*>\s*:?marker\s*["']?\s*([^<"']+)["']?\s*<\/li>/gi;
  while ((match = featurePattern.exec(html)) !== null) {
    const feature = decodeHtml(match[1]).trim();
    if (feature && feature.length > 3) {
      specs.push({ label: 'Feature', value: feature });
    }
  }

  // Also try simpler li pattern
  const simpleLiPattern = /<li[^>]*>([^<]+)<\/li>/gi;
  while ((match = simpleLiPattern.exec(html)) !== null) {
    const text = decodeHtml(match[1]).trim();
    // Filter out :marker and very short text
    if (text && text.length > 10 && !text.includes(':marker')) {
      specs.push({ label: 'Feature', value: text });
    }
  }

  // Extract detailed specs from spec tables/divs
  // Look for patterns like <th>Label</th><td>Value</td>
  const tableSpecPattern = /<(?:th|td)[^>]*>([^<]+)<\/(?:th|td)>\s*<(?:th|td)[^>]*>([^<]+)<\/(?:th|td)>/gi;
  while ((match = tableSpecPattern.exec(html)) !== null) {
    const label = decodeHtml(match[1]).trim();
    const value = decodeHtml(match[2]).trim();
    if (label && value && label.length < 50 && value.length < 200) {
      specs.push({ label, value });
    }
  }

  return specs;
};

export const fetchProductBySku = async (sku, storeId = '071') => {
  try {
    if (!sku || sku.trim().length < 6) {
      throw new Error('Enter valid 6-digit SKU');
    }

    // Build the search URL - using storeid to avoid the store selection page
    const searchUrl = `${BASE_URL}/search/search_results.aspx?Ntt=${sku}&searchButton=search&storeid=${storeId}`;
    
    // Browser headers to avoid Cloudflare bot detection
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.microcenter.com/',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
    };
    
    console.log('Fetching URL:', searchUrl);
    const response = await fetch(searchUrl, { headers });
    console.log('Response status:', response.status);
    const htmlText = await response.text();
    console.log('HTML length:', htmlText.length);

    // Check for "no results" message
    if (htmlText.includes("Oh no!") && htmlText.includes("couldn't find any matches")) {
      return { error: "noResults", searchedSku: sku };
    }

    // Check if we're on a search results page with multiple products
    if (htmlText.includes("search_results.aspx") || htmlText.includes("Search Results") || htmlText.includes("Showing Results For")) {
      // Check if it's a SKU mismatch/redirect
      const redirectMatch = htmlText.match(/You searched for[^\d]+(\d+)[^\d]+Showing Results For[^\d]+(\d+)/i);
      if (redirectMatch) {
        return { error: "skuMismatch", searchedSku: redirectMatch[1], foundSku: redirectMatch[2] };
      }
      // If we're on search results but no clear redirect message, it's likely invalid
      const multiProductMatch = htmlText.match(/data-id=['"](\d+)['"][^>]*data-id=['"](\d+)['"]/i);
      if (multiProductMatch) {
        return { error: "noResults", searchedSku: sku };
      }
    }

    // Try different patterns to find the product ID in the HTML
    let match = htmlText.match(/['"]productId['"]\s*:\s*['"](\d+)['"]/i);
    if (!match) {
      match = htmlText.match(/data-id=['"](\d+)['"]/i);
    }
    if (!match) {
      match = htmlText.match(/<input[^>]*name=['"]productId['"][^>]*value=['"](\d+)['"]/i);
    }

    if (!match || !match[1]) {
      console.error('Failed to find product ID in HTML');
      console.error('HTML contains "Access Denied":', htmlText.includes("Access Denied"));
      console.error('HTML contains "Cloudflare":', htmlText.includes("Cloudflare"));
      console.error('First 1000 chars:', htmlText.substring(0, 1000));
      
      if (htmlText.includes("Access Denied") || htmlText.includes("Cloudflare")) {
        throw new Error("Blocked by Bot Protection");
      }
      throw new Error("Product ID not found");
    }

    const productId = match[1];
    const productUrl = `${BASE_URL}/product/${productId}/*`;

    // Fetch the full product page for detailed specs (with same headers to avoid bot detection)
    const productResponse = await fetch(productUrl, { headers });
    const productHtml = await productResponse.text();

    // Extract actual SKU from the product page
    let actualSku = null;
    const skuMatch = productHtml.match(/<strong[^>]*class=['"]lbl['"][^>]*>SKU:?<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/i) ||
                     productHtml.match(/data-sku=['"](\d+)['"]/i) ||
                     productHtml.match(/['"]sku['"]\s*:\s*['"]?(\d+)['"]?/i);
    if (skuMatch && skuMatch[1]) {
      actualSku = skuMatch[1].trim();
      console.log('Extracted actual SKU from product page:', actualSku);
      console.log('Searched SKU:', sku);
      
      // Check if SKUs match
      if (actualSku !== sku) {
        return { error: "skuMismatch", searchedSku: sku, foundSku: actualSku };
      }
    }

    // Extract product name
    let productName = "";
    const nameMatch = productHtml.match(/<h2[^>]*class=['"]productTi['"][^>]*>([^<]+)<\/h2>/i) ||
                      productHtml.match(/<h1[^>]*data-name=['"]([^'"]+)['"]/i) ||
                      productHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (nameMatch && nameMatch[1]) {
      productName = decodeHtml(nameMatch[1]);
    }

    // Extract brand
    let productBrand = "";
    const brandMatch = productHtml.match(/data-brand=['"]([^'"]+)['"]/i) ||
                       productHtml.match(/<span[^>]*class=['"][^'"]*brand[^'"]*['"][^>]*>([^<]+)<\/span>/i);
    if (brandMatch && brandMatch[1]) {
      productBrand = decodeHtml(brandMatch[1]);
    }

    // Extract price and sale information
    let price = "Price not found";
    let originalPrice = null;
    let savings = null;
    
    // Check for sale price first
    const saleMatch = productHtml.match(/<strike><span[^>]*>Original price <\/span>\$([0-9,]+\.?[0-9]*)<\/strike>[^<]*<span[^>]*>Save \$([0-9,]+\.?[0-9]*)<\/span>/i);
    if (saleMatch) {
      originalPrice = `$${saleMatch[1]}`;
      savings = `$${saleMatch[2]}`;
    }
    
    // Extract current price
    const priceMatch = productHtml.match(/<span[^>]*id=['"]pricing['"][^>]*content="([0-9,]+\.?[0-9]*)"/i) ||
                       productHtml.match(/<span[^>]*id=['"]pricing['"][^>]*>\$?([0-9,]+\.?[0-9]*)<\/span>/i) ||
                       productHtml.match(/data-price=['"]([^'"]+)['"]/i);
    if (priceMatch && priceMatch[1]) {
      const priceNum = priceMatch[1].replace(/,/g, '');
      price = `$${priceNum}`;
    }

    // Extract MFR Part Number from the specs we already extracted
    let mfrPart = "";
    const mfrFromHtml = productHtml.match(/<strong[^>]*class=['"]lbl['"][^>]*>Mfr Part #?:?<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/i);
    if (mfrFromHtml && mfrFromHtml[1]) {
      mfrPart = decodeHtml(mfrFromHtml[1]).trim();
    }

    // Extract UPC from the specs
    let upc = "";
    const upcFromHtml = productHtml.match(/<strong[^>]*class=['"]lbl['"][^>]*>UPC:?<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/i);
    if (upcFromHtml && upcFromHtml[1]) {
      upc = decodeHtml(upcFromHtml[1]).trim();
    }

    // Construct product image URLs - use the productimages subdomain
    // Generate both front_zoom and package_zoom URLs
    // Package images continue numbering from where front images end
    const imageUrls = [];
    
    // Add front_zoom images (01-10)
    for (let imgNum = 1; imgNum <= 10; imgNum++) {
      const imgNumStr = imgNum.toString().padStart(2, '0');
      imageUrls.push(`https://productimages.microcenter.com/${productId}_${sku}_${imgNumStr}_front_zoom.jpg`);
    }
    
    // Add package_zoom images (11-20, continuing from front images)
    for (let imgNum = 11; imgNum <= 20; imgNum++) {
      const imgNumStr = (imgNum - 10).toString().padStart(2, '0'); // Maps 11->01, 12->02, etc.
      imageUrls.push(`https://productimages.microcenter.com/${productId}_${sku}_${imgNumStr}_package_zoom.jpg`);
    }
    
    // Use first image as primary
    const imageUrl = imageUrls[0];
    
    console.log('Generated image URLs (front 01-10 + package 01-10):', imageUrls.length);

    // Extract all detailed specs from z_features JSON and fallback patterns
    const structuredSpecs = extractSpecsFromFeatures(productHtml);
    const detailedSpecs = structuredSpecs.length > 0 ? structuredSpecs : extractSpecs(productHtml);

    // Extract reviews
    const reviews = extractReviews(productHtml);
    
    // Extract Pro Installation services
    const proInstallation = extractProInstallation(productHtml);
    
    // Extract Protection Plans
    const protectionPlans = extractProtectionPlans(productHtml);
    
    // Extract Stock information
    const stockInfo = extractStock(productHtml, storeId);
    
    // Extract Location
    const location = extractLocation(productHtml);

    // Build display name
    let displayName = productName || `Product ${sku}`;
    if (productBrand && !productName.toLowerCase().includes(productBrand.toLowerCase())) {
      displayName = `${productBrand} ${productName}`;
    }

    // Build specs array for display - filter to specific categories
    const specsArray = [];
    
    // Add basic info first
    specsArray.push(`SKU: ${sku}`);
    specsArray.push(`Product ID: ${productId}`);
    if (productBrand) specsArray.push(`Brand: ${productBrand}`);
    if (mfrPart) specsArray.push(`Mfr Part#: ${mfrPart}`);
    if (upc) specsArray.push(`UPC: ${upc}`);

    // Log all specs for debugging
    console.log('All extracted specs:', detailedSpecs.slice(0, 20));
    
    // Group specs by their categories
    const specsByGroup = {};
    const protectionPlanSpecs = []; // Renamed to avoid conflict with extracted protectionPlans
    const protectionPlanPattern = /\d+\s*Year\s*(?:Replacement|Protection)\s*Plan/i;
    
    detailedSpecs.forEach(spec => {
      const label = spec.label;
      const value = spec.value;
      const group = spec.group || 'Other';
      
      // Skip basic info already added
      if (['SKU', 'Mfr Part #', 'UPC', 'Brand'].includes(label)) return;
      
      // Check for protection plans in specs
      if (protectionPlanPattern.test(label) || protectionPlanPattern.test(value)) {
        protectionPlanSpecs.push(`${label}: ${value}`);
        return;
      }
      
      // Group all other specs
      if (!specsByGroup[group]) {
        specsByGroup[group] = [];
      }
      specsByGroup[group].push(`${label}: ${value}`);
    });
    
    // Add specs by group (prioritize display, features, warranty groups)
    const priorityGroups = ['Display', 'Features', 'Connectivity', 'Physical specifications', 'Warranty'];
    
    priorityGroups.forEach(groupName => {
      if (specsByGroup[groupName] && specsByGroup[groupName].length > 0) {
        specsArray.push(`\n${groupName}`);
        specsByGroup[groupName].forEach(s => specsArray.push(`• ${s}`));
        delete specsByGroup[groupName]; // Remove so we don't add twice
      }
    });
    
    // Add protection plan specs if any (from product specs, not the purchasable plans)
    if (protectionPlanSpecs.length > 0) {
      specsArray.push('\nProtection Plan Details');
      protectionPlanSpecs.forEach(p => specsArray.push(`• ${p}`));
    }
    
    // Add remaining groups
    Object.keys(specsByGroup).forEach(groupName => {
      if (specsByGroup[groupName].length > 0) {
        specsArray.push(`\n${groupName}`);
        specsByGroup[groupName].forEach(s => specsArray.push(`• ${s}`));
      }
    });
    
    console.log('Final specs array length:', specsArray.length);

    return {
      sku,
      name: displayName,
      brand: productBrand,
      price,
      originalPrice,
      savings,
      stockText: stockInfo.stockText,
      stock: stockInfo.stock,
      inStock: stockInfo.inStock,
      location,
      imageUrl,
      imageUrls, // All available images
      url: productUrl,
      productId,
      mfrPart,
      upc,
      reviews, // { rating, reviewCount }
      proInstallation, // Array of installation services
      protectionPlans, // Array of protection plans
      detailedSpecs,
      specs: specsArray
    };

  } catch (error) {
    console.error("Scrape Error:", error);
    return { error: error.message };
  }
};