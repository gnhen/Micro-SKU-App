const BASE_URL = 'https://www.microcenter.com';

// Rate limiting to avoid 403 errors
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`[Rate Limit] Waiting ${waitTime}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0'
};

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
  let rating = 0;
  let reviewCount = 0;
  
  const aggregateMatch = html.match(/"aggregateRating"\s*:\s*{[^}]*"ratingValue"\s*:\s*"([0-9.]+)"[^}]*"reviewCount"\s*:\s*"(\d+)"/i);
  if (aggregateMatch) {
    rating = parseFloat(aggregateMatch[1]);
    reviewCount = parseInt(aggregateMatch[2], 10);
  }
  
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
  
  // Find all input/button elements (including checkbox type for installation services)
  const elementPattern = /<(?:input|button)[^>]+>/gi;
  let match;
  
  while ((match = elementPattern.exec(html)) !== null) {
    const element = match[0];
    
    // Check if this element has Installation Service in data-name
    const nameMatch = element.match(/data-name\s*=\s*["']([^"']*Installation Service[^"']*)["']/i);
    const priceMatch = element.match(/data-price\s*=\s*["']([0-9.]+)["']/i);
    
    // Only include if it's NOT in the header (checkboxes/buttons with IDs like "apID..." are product-specific)
    const hasProductId = element.match(/id\s*=\s*["']ap/i);
    
    if (nameMatch && priceMatch && hasProductId) {
      const name = decodeHtml(nameMatch[1]);
      const price = parseFloat(priceMatch[1]);
      installations.push({ name, price });
    }
  }
  
  console.log('Extracted installations:', installations);
  return installations;
};

const extractProtectionPlans = (html) => {
  const plans = [];
  
  // Find all input type="radio" elements, then check if they have plan data
  const elementPattern = /<input[^>]+type\s*=\s*["']radio["'][^>]*>/gi;
  let match;
  
  while ((match = elementPattern.exec(html)) !== null) {
    const element = match[0];
    
    // Check if this element has a plan name and price
    // Updated pattern to include "Replacement" which is common for service plans
    const nameMatch = element.match(/data-name\s*=\s*["']([^"']*(?:\d+\s*Year|Replacement|Protection|Extended|Extension)[^"']*Plan[^"']*)["']/i);
    const priceMatch = element.match(/data-price\s*=\s*["']([0-9.]+)["']/i);
    
    if (nameMatch && priceMatch) {
      const name = decodeHtml(nameMatch[1]);
      const price = parseFloat(priceMatch[1]);
      if (!plans.some(p => p.name === name && p.price === price)) {
        plans.push({ name, price });
      }
    }
  }
  
  console.log('Extracted protection plans:', plans);
  return plans;
};

const extractLocation = (html) => {
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
  
  const stockMatch = html.match(/<span[^>]*class=['"][^'"]*inventoryCnt[^'"]*['"][^>]*>([\s\S]*?)<\/span><span[^>]*class=['"][^'"]*storeName[^'"]*['"][^>]*>([^<]+)<\/span>/i);
  if (stockMatch) {
    let countText = stockMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    const numMatch = countText.match(/(\d+)\+?/);
    if (numMatch) {
      stock = parseInt(numMatch[1], 10);
      inStock = true;
      if (countText.includes('+')) {
        stockText = numMatch[1] + '+ in Stock';
      } else {
        stockText = numMatch[1] + ' in Stock';
      }
    }
    
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
  
  const zFeaturesMatch = html.match(/"z_features"\s*:\s*"([^"]+)"/);
  if (zFeaturesMatch && zFeaturesMatch[1]) {
    const featuresString = zFeaturesMatch[1];
    const featurePairs = featuresString.split(' | ');
    
    featurePairs.forEach(pair => {
      const groupMatch = pair.match(/Group:([^,]+)/);
      const featureMatch = pair.match(/Feature:([^,]+)/);
      const valueMatch = pair.match(/Value:(.+)/);
      
      if (featureMatch && valueMatch) {
        const group = groupMatch ? groupMatch[1].replace(/_/g, ' ') : '';
        const feature = featureMatch[1].replace(/_/g, ' ');
        const value = valueMatch[1].replace(/\\/g, '');
        
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
  
  const infoPattern = /<strong[^>]*class=['"]lbl['"][^>]*>([^<]+)<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/gi;
  let match;
  
  while ((match = infoPattern.exec(html)) !== null) {
    const label = decodeHtml(match[1]).replace(':', '');
    const value = decodeHtml(match[2]);
    if (label && value) {
      specs.push({ label, value });
    }
  }

  const featurePattern = /<li[^>]*>\s*:?marker\s*["']?\s*([^<"']+)["']?\s*<\/li>/gi;
  while ((match = featurePattern.exec(html)) !== null) {
    const feature = decodeHtml(match[1]).trim();
    if (feature && feature.length > 3) {
      specs.push({ label: 'Feature', value: feature });
    }
  }

  const simpleLiPattern = /<li[^>]*>([^<]+)<\/li>/gi;
  while ((match = simpleLiPattern.exec(html)) !== null) {
    const text = decodeHtml(match[1]).trim();
    if (text && text.length > 10 && !text.includes(':marker')) {
      specs.push({ label: 'Feature', value: text });
    }
  }

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
    console.log(`[fetchProductBySku] Starting fetch for SKU: ${sku}, storeId: ${storeId}`);
    let productId = null;
    let productUrl = null;
    let originalSku = sku;

    if (sku && sku.toLowerCase().includes('microcenter.com/product/')) {
       const urlMatch = sku.match(/product\/(\d+)\//i);
       if (urlMatch && urlMatch[1]) {
         productId = urlMatch[1];
         const separator = sku.includes('?') ? '&' : '?';
         productUrl = `${sku}${separator}storeid=${storeId}`;
         console.log(`Detected valid Micro Center product URL. ID: ${productId}`);
       }
    } 
    
    if (!productId && (!sku || sku.trim().length < 1)) {
      console.log('[fetchProductBySku] Invalid SKU - empty input');
      return { error: "noResults", searchedSku: sku || '' };
    }

    let productHtml;

    if (!productId) {
      const searchUrl = `${BASE_URL}/search/search_results.aspx?Ntt=${sku}&searchButton=search&storeid=${storeId}`;
      console.log(`[fetchProductBySku] Fetching search URL: ${searchUrl}`);
      
      await waitForRateLimit(); // Wait to avoid rate limiting
      const response = await fetch(searchUrl, { headers: HEADERS });
      console.log(`[fetchProductBySku] Search response status: ${response.status}, URL: ${response.url}`);
      
      if (response.url && response.url.includes('/product/')) {
        console.log('Search redirected to product page:', response.url);
        
        const idMatch = response.url.match(/product\/(\d+)\//);
        if (idMatch) {
            productId = idMatch[1];
        } else {
            const htmlText = await response.text();
            const match = htmlText.match(/['"]productId['"]\s*:\s*['"](\d+)['"]/i) || 
                          htmlText.match(/data-id=['"](\d+)['"]/i) || 
                          htmlText.match(/<input[^>]*name=['"]productId['"][^>]*value=['"](\d+)['"]/i);
            if (match) productId = match[1];
        }

        if (!productId) {
             throw new Error("Product ID not found on redirected page");
        }
        
        const cleanBaseUrl = response.url.split('?')[0];
        productUrl = `${cleanBaseUrl}?storeid=${storeId}`;
        console.log(`Cleaning redirected URL to: ${productUrl}`);
      } else {
        const htmlText = await response.text();

        if (htmlText.includes("Oh no!") && htmlText.includes("couldn't find any matches")) {
            return { error: "noResults", searchedSku: sku };
        }

        // "0 Results for" in the searchInfoBar is definitive — no real product exists for this SKU.
        // Microcenter may still show a "best guess" product link below it, which we must ignore.
        const zeroResultsMatch = htmlText.match(/searchInfoBar[^>]*>[^<]*0\s+Results?\s+for\s+[""]?([^""\n<]+)[""]?/i);
        if (zeroResultsMatch) {
            console.log(`[fetchProductBySku] Search page reports 0 results — returning noResults`);
            return { error: "noResults", searchedSku: sku };
        }

        if (htmlText.includes("search_results.aspx") || htmlText.includes("Search Results") || htmlText.includes("Showing Results For")) {
            // Check if it's a SKU mismatch/redirect
            const redirectMatch = htmlText.match(/You searched for[^\d]+(\d+)[^\d]+Showing Results For[^\d]+(\d+)/i);
            if (redirectMatch) {
                return { error: "skuMismatch", searchedSku: redirectMatch[1], foundSku: redirectMatch[2] };
            }
            
            // Heuristic to avoid header/navigation links (like "Services", "Top Deals"):
            // Search results usually appear after the "Sort" dropdown or "Result count" text.
            // We strip the header part of the HTML to ensure we find a link from the actual result list.
            const resultStartMarkers = [
                'Sort by:', 
                'sort by:', 
                'Sort By:',
                'class="result_list"',
                'items found',
                'Showing'
            ];
            
            let searchStartIndex = 0;
            for (const marker of resultStartMarkers) {
                const idx = htmlText.indexOf(marker);
                if (idx > -1 && idx > searchStartIndex) {
                    // We want the start of the results, which is typically after the LAST occurrence of "Sort by" or headers
                    // Actually, "Sort by" appears once at the top of the list.
                    searchStartIndex = idx;
                    // Once we find a strong marker like "Sort by", we can break or just take it.
                    // "Sort by" is very reliable.
                    break;
                }
            }

            const relevantHtml = searchStartIndex > 0 ? htmlText.substring(searchStartIndex) : htmlText;

            // Try to find the first product link to get the full URL (with slug)
            // Relaxed regex to find hrefs more easily (handles single or double quotes)
            const linkMatch = relevantHtml.match(/href=["'](\/product\/\d+\/[^"']+)["']/i);
            
            if (linkMatch && linkMatch[1]) {
                // Verify the searched SKU actually appears in the product card near this link.
                // Microcenter sometimes returns a "best guess" product for unrecognised SKUs.
                // In those cases the card won't contain the searched SKU at all.
                const linkIndex = relevantHtml.indexOf(linkMatch[0]);
                const cardContext = relevantHtml.substring(Math.max(0, linkIndex - 300), linkIndex + 800);
                if (!cardContext.includes(sku)) {
                    console.log(`[fetchProductBySku] Found product link but SKU ${sku} not in card context — treating as no results`);
                    return { error: "noResults", searchedSku: sku };
                }

                productUrl = BASE_URL + linkMatch[1] + `?storeid=${storeId}`;
                const idMatch = linkMatch[1].match(/product\/(\d+)\//);
                if (idMatch) productId = idMatch[1];
                console.log('Found product link on search page:', productUrl);
            } else {
                const multiProductMatch = htmlText.match(/data-id=['"](\d+)['"][^>]*data-id=['"](\d+)['"]/i);
                if (multiProductMatch) {
                    return { error: "noResults", searchedSku: sku };
                }
            }
        }
        
        if (!productId) {
            let match = htmlText.match(/['"]productId['"]\s*:\s*['"](\d+)['"]/i);
            if (!match) {
                match = htmlText.match(/data-id=['"](\d+)['"]/i);
            }
            if (!match) {
                match = htmlText.match(/<input[^>]*name=['"]productId['"][^>]*value=['"](\d+)['"]/i);
            }

            if (!match || !match[1]) {
                if (htmlText.includes("Access Denied") || htmlText.includes("Cloudflare")) {
                throw new Error("Blocked by Bot Protection");
                }
                throw new Error("Product ID not found");
            }

            productId = match[1];
        }

        if (!productUrl) {
            productUrl = `${BASE_URL}/product/${productId}/?storeid=${storeId}`;
            console.log('Constructed ID-only URL (might require slug):', productUrl);
        }
      }
    }

    if (typeof productHtml === 'undefined') {
        console.log(`[fetchProductBySku] Fetching product page: ${productUrl}`);
        await waitForRateLimit(); // Wait to avoid rate limiting
        const productResponse = await fetch(productUrl, { headers: HEADERS });
        console.log(`[fetchProductBySku] Product response status: ${productResponse.status}`);
        productHtml = await productResponse.text();
        console.log(`[fetchProductBySku] Product HTML length: ${productHtml.length}`);
    }

    let actualSku = null;
    const skuMatch = productHtml.match(/<strong[^>]*class=['"]lbl['"][^>]*>SKU:?<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/i) ||
                     productHtml.match(/data-sku=['"](\d+)['"]/i) ||
                     productHtml.match(/['"]sku['"]\s*:\s*['"]?(\d+)['"]?/i);
    if (skuMatch && skuMatch[1]) {
      actualSku = skuMatch[1].trim();
      console.log('Extracted actual SKU from product page:', actualSku);
      console.log('Searched SKU:', sku);
      
      if (originalSku && originalSku.toLowerCase().includes('microcenter.com/product/')) {
         console.log('URL search detected, adopting page SKU:', actualSku);
         sku = actualSku;
      } else if (actualSku !== sku) {
        return { error: "skuMismatch", searchedSku: sku, foundSku: actualSku };
      }
    }

    let productName = "";
    let contentStartIndex = 0;

    // Try multiple patterns in order of reliability.
    // 1. h2 with class containing "productTi" (e.g. "productTitle")
    const h2Match = productHtml.match(/<h2[^>]*class=['"][^'"]*productTi[^'"]*['"][^>]*>([\s\S]*?)<\/h2>/i);
    // 2. h1 with data-name attribute
    const h1DataMatch = productHtml.match(/<h1[^>]*data-name=['"]([^'"]+)['"]/i);
    // 3. h1 with any content (strip inner tags)
    const h1Match = productHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    // 4. og:title meta tag as reliable fallback
    const ogTitleMatch = productHtml.match(/<meta[^>]*property=['"]og:title['"][^>]*content=['"]([^'"]+)['"]/i) ||
                         productHtml.match(/<meta[^>]*content=['"]([^'"]+)['"]\s[^>]*property=['"]og:title['"]/i);
    // 5. <title> tag as last resort (often "Product Name - Micro Center")
    const titleTagMatch = productHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    if (h2Match) {
      productName = decodeHtml(h2Match[1].replace(/<[^>]+>/g, '').trim());
      contentStartIndex = h2Match.index;
    } else if (h1DataMatch) {
      productName = decodeHtml(h1DataMatch[1]);
      contentStartIndex = h1DataMatch.index;
    } else if (h1Match) {
      productName = decodeHtml(h1Match[1].replace(/<[^>]+>/g, '').trim());
      contentStartIndex = h1Match.index;
    } else if (ogTitleMatch) {
      // Strip " - Micro Center" / " | Micro Center" / "| Micro Center" suffixes
      productName = decodeHtml(ogTitleMatch[1].replace(/\s*[\-|]\s*(Micro.?Center.*)?$/i, '').trim());
    } else if (titleTagMatch) {
      // Strip " - Micro Center" or similar suffixes
      productName = decodeHtml(titleTagMatch[1].replace(/<[^>]+>/g, '').replace(/\s*[\-|]\s*(Micro.?Center.*)?$/i, '').trim());
    }

    // Guard: if we still couldn't extract a product name the page isn't a real product page.
    // Return noResults to prevent phantom products being displayed.
    if (!productName || productName.trim() === '') {
      console.log('[fetchProductBySku] No product name found on page — treating as no results');
      return { error: "noResults", searchedSku: originalSku };
    }

    let productBrand = "";
    const brandMatch = productHtml.match(/data-brand=['"]([^'"]+)['"]/i) ||
                       productHtml.match(/<span[^>]*class=['"][^'"]*brand[^'"]*['"][^>]*>([^<]+)<\/span>/i);
    if (brandMatch && brandMatch[1]) {
      const rawBrand = decodeHtml(brandMatch[1]);
      // Ignore generic/site brands that aren't real product brands
      if (!/micro.?center/i.test(rawBrand)) {
        productBrand = rawBrand;
      }
    }

    let price = "Price not found";
    let originalPrice = null;
    let savings = null;
    
    // Try multiple patterns for sale prices
    // Pattern 1: Original structure
    let saleMatch = productHtml.match(/<strike><span[^>]*>Original price <\/span>\$([0-9,]+\.?[0-9]*)<\/strike>[^<]*<span[^>]*>Save \$([0-9,]+\.?[0-9]*)<\/span>/i);
    if (saleMatch) {
      originalPrice = `$${saleMatch[1]}`;
      savings = `$${saleMatch[2]}`;
    }
    
    // Pattern 2: Look for strike tag with price anywhere, then look for savings span separately
    if (!originalPrice) {
      const strikeMatch = productHtml.match(/<strike><span[^>]*class=['"]sr-only['"][^>]*>Original price\s*<\/span>\$([0-9,]+\.?[0-9]*)<\/strike>/i);
      if (strikeMatch) {
        originalPrice = `$${strikeMatch[1]}`;
      }
    }
    
    if (!savings) {
      const savingsMatch = productHtml.match(/<span[^>]*class=['"][^'"]*savings[^'"]*['"][^>]*>Save \$([0-9,]+\.?[0-9]*)<\/span>/i);
      if (savingsMatch) {
        savings = `$${savingsMatch[1]}`;
      }
    }
    
    const priceMatch = productHtml.match(/<span[^>]*id=['"]pricing['"][^>]*content="([0-9,]+\.?[0-9]*)"/i) ||
                       productHtml.match(/<span[^>]*id=['"]pricing['"][^>]*>\$?([0-9,]+\.?[0-9]*)<\/span>/i) ||
                       productHtml.match(/data-price=['"]([^'"]+)['"]/i);
    if (priceMatch && priceMatch[1]) {
      const priceNum = priceMatch[1].replace(/,/g, '');
      price = `$${priceNum}`;
    }

    let mfrPart = "";
    const mfrFromHtml = productHtml.match(/<strong[^>]*class=['"]lbl['"][^>]*>Mfr Part #?:?<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/i);
    if (mfrFromHtml && mfrFromHtml[1]) {
      mfrPart = decodeHtml(mfrFromHtml[1]).trim();
    }

    let upc = "";
    const upcFromHtml = productHtml.match(/<strong[^>]*class=['"]lbl['"][^>]*>UPC:?<\/strong>\s*<span[^>]*class=['"]item['"][^>]*>([^<]+)<\/span>/i);
    if (upcFromHtml && upcFromHtml[1]) {
      upc = decodeHtml(upcFromHtml[1]).trim();
    }

    const imageUrls = [];
    
    for (let imgNum = 1; imgNum <= 10; imgNum++) {
      const imgNumStr = imgNum.toString().padStart(2, '0');
      imageUrls.push(`https://productimages.microcenter.com/${productId}_${sku}_${imgNumStr}_front_zoom.jpg`);
    }
    
    for (let imgNum = 11; imgNum <= 20; imgNum++) {
      const imgNumStr = (imgNum - 10).toString().padStart(2, '0');
      imageUrls.push(`https://productimages.microcenter.com/${productId}_${sku}_${imgNumStr}_package_zoom.jpg`);
    }
    
    const imageUrl = imageUrls[0];
    
    console.log('Generated image URLs (front 01-10 + package 01-10):', imageUrls.length);

    const structuredSpecs = extractSpecsFromFeatures(productHtml);
    const detailedSpecs = structuredSpecs.length > 0 ? structuredSpecs : extractSpecs(productHtml);

    const reviews = extractReviews(productHtml);
    
    // Search the full HTML for services/plans - they appear before the product title
    // The id="ap..." check in extractProInstallation filters out header navigation links
    const proInstallation = extractProInstallation(productHtml);
    
    const protectionPlans = extractProtectionPlans(productHtml);
    
    const stockInfo = extractStock(productHtml, storeId);
    
    const location = extractLocation(productHtml);

    let displayName = productName || `Product ${sku}`;
    if (productBrand && !productName.toLowerCase().includes(productBrand.toLowerCase())) {
      displayName = `${productBrand} ${productName}`;
    }

    const specsArray = [];
    
    specsArray.push(`SKU: ${sku}`);
    specsArray.push(`Product ID: ${productId}`);
    if (productBrand) specsArray.push(`Brand: ${productBrand}`);
    if (mfrPart) specsArray.push(`Mfr Part#: ${mfrPart}`);
    if (upc) specsArray.push(`UPC: ${upc}`);

    console.log('All extracted specs:', detailedSpecs.slice(0, 20));
    
    const specsByGroup = {};
    const protectionPlanSpecs = [];
    const protectionPlanPattern = /\d+\s*Year\s*(?:Replacement|Protection)\s*Plan/i;
    
    detailedSpecs.forEach(spec => {
      const label = spec.label;
      const value = spec.value;
      const group = spec.group || 'Other';
      
      if (['SKU', 'Mfr Part #', 'UPC', 'Brand'].includes(label)) return;
      
      if (protectionPlanPattern.test(label) || protectionPlanPattern.test(value)) {
        protectionPlanSpecs.push(`${label}: ${value}`);
        return;
      }
      
      if (!specsByGroup[group]) {
        specsByGroup[group] = [];
      }
      specsByGroup[group].push(`${label}: ${value}`);
    });
    
    const priorityGroups = ['Display', 'Features', 'Connectivity', 'Physical specifications', 'Warranty'];
    
    priorityGroups.forEach(groupName => {
      if (specsByGroup[groupName] && specsByGroup[groupName].length > 0) {
        specsArray.push(`\n${groupName}`);
        specsByGroup[groupName].forEach(s => specsArray.push(`• ${s}`));
        delete specsByGroup[groupName];
      }
    });
    
    if (protectionPlanSpecs.length > 0) {
      specsArray.push('\nProtection Plan Details');
      protectionPlanSpecs.forEach(p => specsArray.push(`• ${p}`));
    }
    
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
      imageUrls,
      url: productUrl,
      productId,
      mfrPart,
      upc,
      reviews,
      proInstallation,
      protectionPlans,
      detailedSpecs,
      specs: specsArray
    };

  } catch (error) {
    console.error("[fetchProductBySku] Scrape Error:", error);
    console.error("[fetchProductBySku] Error stack:", error.stack);
    return { error: error.message };
  }
};

// ── Text / keyword search ─────────────────────────────────────────────────────
// Returns { results: [{sku, name, price, url}] } or { singleUrl } or { error }
export const fetchTextSearch = async (query, storeId = '071') => {
  try {
    const encoded = encodeURIComponent(query.trim());
    const searchUrl = `${BASE_URL}/search/search_results.aspx?Ntt=${encoded}&searchButton=search&storeid=${storeId}`;
    console.log(`[fetchTextSearch] Fetching: ${searchUrl}`);

    await waitForRateLimit();
    const response = await fetch(searchUrl, { headers: HEADERS });

    // Redirect straight to a product page → treat as single result
    if (response.url && response.url.includes('/product/')) {
      const cleanUrl = response.url.split('?')[0] + `?storeid=${storeId}`;
      console.log('[fetchTextSearch] Redirected to single product:', cleanUrl);
      return { singleUrl: cleanUrl };
    }

    const html = await response.text();

    // Anchor results section after "Sort by:" so we skip nav/header links
    const sortIdx = html.indexOf('Sort by:');
    const relevantHtml = sortIdx > -1 ? html.substring(sortIdx) : html;

    // Each product card is preceded by "Add SKU:XXXXXX to wishlist" anchor text
    const skuAnchorRegex = /Add SKU:(\d+) to wishlist/g;
    const results = [];
    let m;

    while ((m = skuAnchorRegex.exec(relevantHtml)) !== null && results.length < 24) {
      const sku = m[1];
      // Slice the ~800 chars after this anchor to get the card content
      const cardSlice = relevantHtml.substring(m.index, m.index + 900);

      // Product data lives on the <a class="...productClickItemV2..."> element
      // e.g. data-brand="Raspberry Pi" data-name="5" data-price="204.99" data-id="702590" href="/product/702590/..."
      const aTagMatch = cardSlice.match(/<a[^>]*class="[^"]*productClickItemV2[^"]*"([^>]*)href="(\/product\/[^"?]+)/i);
      if (!aTagMatch) continue;

      const attrs = aTagMatch[1];
      const href = aTagMatch[2];
      const url = BASE_URL + href + `?storeid=${storeId}`;

      const brandAttr   = (attrs.match(/data-brand="([^"]*)"/i)  || [])[1] || '';
      const nameAttr    = (attrs.match(/data-name="([^"]*)"/i)   || [])[1] || '';
      const priceAttr   = (attrs.match(/data-price="([^"]*)"/i)  || [])[1] || '';
      const productId   = (attrs.match(/data-id="([^"]*)"/i)     || [])[1] || '';

      const brand = decodeHtml(brandAttr);
      const partial = decodeHtml(nameAttr);
      // Combine brand + partial name, avoiding duplication (e.g. "Raspberry Pi" + "5" → "Raspberry Pi 5")
      const name = brand && partial && !partial.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} ${partial}`
        : (partial || brand);

      if (!name) continue;

      const price = priceAttr ? `$${priceAttr}` : null;

      // Thumbnail: first front image using productId + sku
      const imageUrl = productId && sku
        ? `https://productimages.microcenter.com/${productId}_${sku}_01_front_zoom.jpg`
        : null;

      // Stock text: "25+ IN STOCK", "3 IN STOCK", "0 IN STOCK", etc.
      const stockMatch = cardSlice.match(/(\d+\+?\s+IN\s+STOCK[^<"]*)/i);
      const stockText = stockMatch ? stockMatch[1].trim() : null;

      results.push({ sku, name, price, url, imageUrl, stockText });
    }

    console.log(`[fetchTextSearch] Parsed ${results.length} results`);
    return { results };
  } catch (error) {
    console.error('[fetchTextSearch] Error:', error);
    return { error: error.message };
  }
};