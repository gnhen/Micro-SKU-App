export const CHALLENGE_URL_PATTERN = /__cf_chl_|\/cdn-cgi\/challenge-platform/i;
export const CHALLENGE_TEXT_PATTERN = /just a moment|attention required|verify you are human/i;

export const isChallengeSignal = (url = '', title = '', hasChallenge = false) => {
  if (hasChallenge) return true;
  return CHALLENGE_URL_PATTERN.test(url) || CHALLENGE_TEXT_PATTERN.test(title);
};

export const CHALLENGE_SIGNAL_SCRIPT = `
(function() {
  try {
    var title = document.title || '';
    var userAgent = navigator.userAgent || '';
    
    // Only check for elements that actually contain the challenge
    var hasCFElement = document.getElementById('challenge-stage') !== null || document.getElementById('cf-please-wait') !== null;
    var isChallengeTitle = /just a moment|attention required|verify you are human/i.test(title);
    var hasChallenge = isChallengeTitle || hasCFElement;

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'pageSignals',
      title: title,
      url: window.location.href,
      hasChallenge: hasChallenge,
      userAgent: userAgent
    }));
  } catch (error) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'pageSignalsError',
      message: String(error)
    }));
  }
})();
true;
`;

export const buildProductExtractionScript = (searchedSku = '') => {
  const escapedSku = JSON.stringify(String(searchedSku || ''));

  return `
(function() {
  function post(payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (_) {}
  }

  function textFromNode(node) {
    if (!node) return '';
    return String(node.textContent || '').replace(/\\s+/g, ' ').trim();
  }

  function fromLabel(labelText) {
    var labels = document.querySelectorAll('strong.lbl');
    for (var i = 0; i < labels.length; i++) {
      var label = textFromNode(labels[i]).toLowerCase();
      if (label.indexOf(String(labelText).toLowerCase()) !== -1) {
        var sibling = labels[i].nextElementSibling;
        if (sibling && sibling.className && String(sibling.className).indexOf('item') !== -1) {
          var value = textFromNode(sibling);
          if (value) return value;
        }
      }
    }
    return '';
  }

  function absoluteUrl(url) {
    try {
      return new URL(url, window.location.origin).toString();
    } catch (_) {
      return url || '';
    }
  }

  try {
    var preferredSku = String(${escapedSku} || '').trim();
    var currentUrl = window.location.href;
    var path = window.location.pathname || '';
    var isProductPage = /\\/product\\/\\d+\\//i.test(path);

    if (!isProductPage) {
      var links = Array.prototype.slice.call(document.querySelectorAll('a[href*="/product/"]'));

      if (links.length > 0 && preferredSku) {
        var preferred = null;
        for (var i = 0; i < links.length; i++) {
          var node = links[i];
          var container = node.closest('li,article,.result_left,.result_right,.product_wrapper,div') || node;
          var context = textFromNode(container);
          if (context.indexOf(preferredSku) !== -1) {
            preferred = node;
            break;
          }
        }
        if (preferred) {
          window.location.href = absoluteUrl(preferred.getAttribute('href') || '');
          return;
        }

        post({
          type: 'productExtract',
          status: 'noExactMatch',
          searchedSku: preferredSku,
          url: currentUrl
        });
        return;
      }

      if (links.length === 1) {
        window.location.href = absoluteUrl(links[0].getAttribute('href') || '');
        return;
      }

      post({ type: 'productExtract', status: 'noProductLink', url: currentUrl });
      return;
    }

    var titleNode = document.querySelector('h2[class*="productTi"], h1[data-name], h1');
    var name = textFromNode(titleNode);
    if (!name) {
      var ogTitle = document.querySelector('meta[property="og:title"]');
      name = ogTitle ? String(ogTitle.getAttribute('content') || '').replace(/\\s*[\\-|]\\s*Micro.?Center.*$/i, '').trim() : '';
    }

    var sku = fromLabel('sku');
    if (!sku) {
      var skuMatch = document.documentElement.innerHTML.match(/['\"]sku['\"]\\s*:\\s*['\"]?(\\d{4,})['\"]?/i);
      if (skuMatch && skuMatch[1]) sku = skuMatch[1];
    }

    if (preferredSku && sku && String(sku).trim() !== preferredSku) {
      post({
        type: 'productExtract',
        status: 'skuMismatch',
        searchedSku: preferredSku,
        foundSku: String(sku).trim(),
        url: currentUrl
      });
      return;
    }

    var pricingNode = document.querySelector('#pricing');
    var rawPrice = '';
    if (pricingNode) {
      rawPrice = pricingNode.getAttribute('content') || textFromNode(pricingNode);
    }
    rawPrice = String(rawPrice || '').replace(/[^0-9.]/g, '');
    var price = rawPrice ? ('$' + rawPrice) : null;

    var inventoryNode = document.querySelector('span.inventoryCnt');
    var stockText = textFromNode(inventoryNode);
    if (!stockText) {
      var bodyMatch = document.body && document.body.innerText
        ? document.body.innerText.match(/(\\d+\\+?\\s+(?:NEW\\s+)?(?:OPEN\\s+BOX\\s+)?IN\\s+STOCK|OUT\\s+OF\\s+STOCK)/i)
        : null;
      stockText = bodyMatch ? bodyMatch[1] : '';
    }

    var lowerStock = String(stockText || '').toLowerCase();
    var inStock = lowerStock.includes('in stock') && !lowerStock.includes('out of stock');
    var stockMatch = String(stockText || '').match(/(\\d+)/);
    var stock = stockMatch ? parseInt(stockMatch[1], 10) : (inStock ? 1 : 0);

    var productIdMatch = path.match(/\\/product\\/(\\d+)\\//i);
    var productId = productIdMatch && productIdMatch[1] ? productIdMatch[1] : null;

    var ogImage = document.querySelector('meta[property="og:image"]');
    var imageUrl = ogImage ? String(ogImage.getAttribute('content') || '') : '';
    if (!imageUrl) {
      var imgNode = document.querySelector('img[src*="productimages.microcenter.com"], img');
      imageUrl = imgNode ? absoluteUrl(imgNode.getAttribute('src') || '') : '';
    }

    var mfrPart = fromLabel('mfr part');
    var upc = fromLabel('upc');
    var brand = fromLabel('brand');

    post({
      type: 'productExtract',
      status: 'ok',
      data: {
        sku: sku || preferredSku || '',
        name: name || (sku ? ('Product ' + sku) : 'Product'),
        price: price || 'Price not found',
        stockText: stockText || null,
        stock: Number.isFinite(stock) ? stock : 0,
        inStock: !!inStock,
        imageUrl: imageUrl || null,
        imageUrls: imageUrl ? [imageUrl] : [],
        url: currentUrl,
        productId,
        mfrPart: mfrPart || '',
        upc: upc || '',
        brand: brand || '',
        reviews: { rating: 0, reviewCount: 0 },
        proInstallation: [],
        protectionPlans: [],
        detailedSpecs: [],
        specs: []
      }
    });
  } catch (error) {
    post({
      type: 'productExtract',
      status: 'error',
      message: String(error),
      url: window.location.href
    });
  }
})();
true;
`;
};
