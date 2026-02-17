const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Microcenter PC Builder Scraper
 * Extracts bundle configurations, component compatibility data, and pricing
 */

const URLS = {
  pcBuilder: 'https://www.microcenter.com/site/content/custom-pc-builder.aspx',
  bundleSave: 'https://www.microcenter.com/site/content/bundle-and-save.aspx',
  intelBundle: 'https://www.microcenter.com/site/content/intel-bundle-and-save.aspx',
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Scrape PC Builder page for component data and compatibility rules
 */
async function scrapePCBuilder() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    console.log('Navigating to PC Builder...');
    await page.goto(URLS.pcBuilder, { 
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await delay(3000); // Wait for JavaScript to load

    // Extract component categories
    console.log('Extracting component categories...');
    const categories = await page.evaluate(() => {
      const cats = [];
      const categoryElements = document.querySelectorAll('[data-category], .component-section, .pc-component');
      
      categoryElements.forEach((el, index) => {
        const categoryName = el.getAttribute('data-category') || 
                           el.querySelector('.category-name, .component-title')?.textContent?.trim() ||
                           `category_${index}`;
        
        if (categoryName && !cats.find(c => c.name === categoryName)) {
          cats.push({
            name: categoryName.toLowerCase().replace(/\s+/g, '_'),
            displayName: categoryName,
            order: index,
          });
        }
      });
      
      return cats;
    });

    console.log(`Found ${categories.length} categories:`, categories.map(c => c.name));

    // Extract bundle configurations
    console.log('Extracting bundle configurations...');
    const bundles = await page.evaluate(() => {
      const bundleData = [];
      const bundleElements = document.querySelectorAll('[data-bundle], .bundle-option, .preset-build');
      
      bundleElements.forEach(el => {
        const bundleName = el.querySelector('.bundle-name, .build-name')?.textContent?.trim();
        const bundlePrice = el.querySelector('.bundle-price, .price')?.textContent?.trim();
        const description = el.querySelector('.bundle-description, .description')?.textContent?.trim();
        
        if (bundleName) {
          bundleData.push({
            name: bundleName,
            price: bundlePrice,
            description: description || '',
            components: [],
          });
        }
      });
      
      return bundleData;
    });

    console.log(`Found ${bundles.length} bundle configurations`);

    // Extract compatibility rules from page scripts
    console.log('Extracting compatibility data...');
    const compatibilityData = await page.evaluate(() => {
      const rules = [];
      
      // Try to find compatibility data in script tags
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || '';
        
        // Look for socket type mentions
        const socketMatches = content.match(/(LGA\d+|AM\d+|TR\d+)/g);
        if (socketMatches) {
          rules.push({ type: 'sockets', values: [...new Set(socketMatches)] });
        }
        
        // Look for DDR memory types
        const memoryMatches = content.match(/DDR[45]/g);
        if (memoryMatches) {
          rules.push({ type: 'memory_types', values: [...new Set(memoryMatches)] });
        }
        
        // Look for form factors
        const formFactorMatches = content.match(/(ATX|mATX|Mini-ITX|E-ATX)/gi);
        if (formFactorMatches) {
          rules.push({ type: 'form_factors', values: [...new Set(formFactorMatches)] });
        }
      }
      
      return rules;
    });

    console.log('Compatibility data extracted:', compatibilityData);

    // Take a screenshot for reference
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'pc-builder.png'), fullPage: true });

    return {
      categories,
      bundles,
      compatibilityData,
      scrapedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error scraping PC Builder:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Scrape Bundle & Save pages for pre-configured bundles
 */
async function scrapeBundles() {
  console.log('Launching browser for bundle scraping...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const allBundles = [];

    for (const [name, url] of Object.entries({ bundleSave: URLS.bundleSave, intelBundle: URLS.intelBundle })) {
      console.log(`Scraping ${name}...`);
      const page = await browser.newPage();
      
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      try {
        await page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: 60000,
        });

        await delay(3000);

        const bundles = await page.evaluate(() => {
          const bundleData = [];
          
          // Look for bundle cards/sections
          const bundleElements = document.querySelectorAll('.bundle-card, .product-bundle, [data-bundle-id]');
          
          bundleElements.forEach(el => {
            const name = el.querySelector('h2, h3, .bundle-title, .product-title')?.textContent?.trim();
            const description = el.querySelector('.description, .bundle-desc')?.textContent?.trim();
            const totalPrice = el.querySelector('.original-price, .total-price')?.textContent?.trim();
            const bundlePrice = el.querySelector('.bundle-price, .sale-price')?.textContent?.trim();
            
            // Extract component SKUs
            const componentLinks = el.querySelectorAll('a[href*="/product/"]');
            const components = Array.from(componentLinks).map(link => {
              const href = link.getAttribute('href');
              const skuMatch = href?.match(/\/product\/(\d+)/);
              return {
                sku: skuMatch ? skuMatch[1] : null,
                name: link.textContent?.trim(),
              };
            }).filter(c => c.sku);

            if (name && bundlePrice) {
              bundleData.push({
                name,
                description: description || '',
                totalPrice: totalPrice || '',
                bundlePrice: bundlePrice || '',
                components,
              });
            }
          });
          
          return bundleData;
        });

        console.log(`Found ${bundles.length} bundles on ${name}`);
        allBundles.push(...bundles);

        await page.screenshot({ path: path.join(__dirname, 'screenshots', `${name}.png`), fullPage: true });
        await page.close();

      } catch (error) {
        console.error(`Error scraping ${name}:`, error);
        await page.close();
      }

      await delay(2000); // Rate limiting
    }

    return {
      bundles: allBundles,
      scrapedAt: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error scraping bundles:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Scrape individual component page for detailed specs
 */
async function scrapeComponentDetails(sku) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const url = `https://www.microcenter.com/product/${sku}`;
    console.log(`Scraping component: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    const componentData = await page.evaluate(() => {
      const specs = {};
      
      // Extract from specs table
      const specRows = document.querySelectorAll('.specs tr, .specifications tr, table tr');
      specRows.forEach(row => {
        const label = row.querySelector('th, td:first-child')?.textContent?.trim();
        const value = row.querySelector('td:last-child')?.textContent?.trim();
        if (label && value && label !== value) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
          specs[key] = value;
        }
      });

      return {
        name: document.querySelector('h1, .product-title')?.textContent?.trim(),
        brand: document.querySelector('.brand, [itemprop="brand"]')?.textContent?.trim(),
        price: document.querySelector('.price, [itemprop="price"]')?.textContent?.trim(),
        sku: document.querySelector('[data-sku]')?.getAttribute('data-sku'),
        imageUrl: document.querySelector('.product-image img, [itemprop="image"]')?.getAttribute('src'),
        specs,
      };
    });

    return componentData;

  } catch (error) {
    console.error(`Error scraping component ${sku}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Main scraping function
 */
async function runFullScrape() {
  console.log('Starting full scrape...\n');

  try {
    // Create screenshots directory
    await fs.mkdir(path.join(__dirname, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });

    // Scrape PC Builder
    console.log('=== SCRAPING PC BUILDER ===');
    const pcBuilderData = await scrapePCBuilder();
    await fs.writeFile(
      path.join(__dirname, 'data', 'pc-builder-data.json'),
      JSON.stringify(pcBuilderData, null, 2)
    );
    console.log('✓ PC Builder data saved\n');

    await delay(3000);

    // Scrape Bundles
    console.log('=== SCRAPING BUNDLES ===');
    const bundleData = await scrapeBundles();
    await fs.writeFile(
      path.join(__dirname, 'data', 'bundle-data.json'),
      JSON.stringify(bundleData, null, 2)
    );
    console.log('✓ Bundle data saved\n');

    console.log('=== SCRAPING COMPLETE ===');
    console.log(`PC Builder Categories: ${pcBuilderData.categories.length}`);
    console.log(`Bundles Found: ${bundleData.bundles.length}`);
    console.log('\nData saved to ./data/ directory');
    console.log('Screenshots saved to ./screenshots/ directory');

    return {
      pcBuilder: pcBuilderData,
      bundles: bundleData,
    };

  } catch (error) {
    console.error('Scraping failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runFullScrape();
}

module.exports = {
  scrapePCBuilder,
  scrapeBundles,
  scrapeComponentDetails,
  runFullScrape,
};
