const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { scrapePCBuilder, scrapeBundles, scrapeComponentDetails } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Cache for scraped data
let cachedData = {
  pcBuilder: null,
  bundles: null,
  lastUpdated: null,
};

// Load cached data on startup
async function loadCachedData() {
  try {
    const pcBuilderData = await fs.readFile(path.join(__dirname, 'data', 'pc-builder-data.json'), 'utf-8');
    const bundleData = await fs.readFile(path.join(__dirname, 'data', 'bundle-data.json'), 'utf-8');
    
    cachedData.pcBuilder = JSON.parse(pcBuilderData);
    cachedData.bundles = JSON.parse(bundleData);
    cachedData.lastUpdated = new Date(Math.min(
      new Date(cachedData.pcBuilder.scrapedAt),
      new Date(cachedData.bundles.scrapedAt)
    ));
    
    console.log('✓ Loaded cached data from disk');
  } catch (error) {
    console.log('No cached data found, will scrape on first request');
  }
}

// Routes

/**
 * GET / - Health check
 */
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Microcenter PC Builder Scraper API',
    version: '1.0.0',
    lastUpdated: cachedData.lastUpdated,
  });
});

/**
 * GET /api/categories - Get component categories
 */
app.get('/api/categories', async (req, res) => {
  try {
    if (!cachedData.pcBuilder) {
      console.log('Scraping PC Builder data...');
      cachedData.pcBuilder = await scrapePCBuilder();
      cachedData.lastUpdated = new Date();
    }
    
    res.json({
      categories: cachedData.pcBuilder.categories,
      lastUpdated: cachedData.lastUpdated,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/bundles - Get all bundles
 */
app.get('/api/bundles', async (req, res) => {
  try {
    if (!cachedData.bundles) {
      console.log('Scraping bundle data...');
      cachedData.bundles = await scrapeBundles();
      cachedData.lastUpdated = new Date();
    }
    
    res.json({
      bundles: cachedData.bundles.bundles,
      count: cachedData.bundles.bundles.length,
      lastUpdated: cachedData.lastUpdated,
    });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

/**
 * GET /api/component/:sku - Get component details by SKU
 */
app.get('/api/component/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    
    if (!sku || !/^\d+$/.test(sku)) {
      return res.status(400).json({ error: 'Invalid SKU format' });
    }
    
    console.log(`Scraping component details for SKU: ${sku}`);
    const componentData = await scrapeComponentDetails(sku);
    
    res.json({
      component: componentData,
      scrapedAt: new Date(),
    });
  } catch (error) {
    console.error(`Error fetching component ${req.params.sku}:`, error);
    res.status(500).json({ error: 'Failed to fetch component details' });
  }
});

/**
 * POST /api/refresh - Force refresh all cached data
 */
app.post('/api/refresh', async (req, res) => {
  try {
    console.log('Force refreshing all data...');
    
    const [pcBuilder, bundles] = await Promise.all([
      scrapePCBuilder(),
      scrapeBundles(),
    ]);
    
    cachedData.pcBuilder = pcBuilder;
    cachedData.bundles = bundles;
    cachedData.lastUpdated = new Date();
    
    // Save to disk
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    await fs.writeFile(
      path.join(__dirname, 'data', 'pc-builder-data.json'),
      JSON.stringify(pcBuilder, null, 2)
    );
    await fs.writeFile(
      path.join(__dirname, 'data', 'bundle-data.json'),
      JSON.stringify(bundles, null, 2)
    );
    
    res.json({
      success: true,
      message: 'Data refreshed successfully',
      lastUpdated: cachedData.lastUpdated,
      stats: {
        categories: pcBuilder.categories.length,
        bundles: bundles.bundles.length,
      },
    });
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.status(500).json({ error: 'Failed to refresh data' });
  }
});

/**
 * GET /api/compatibility - Get compatibility rules
 */
app.get('/api/compatibility', async (req, res) => {
  try {
    if (!cachedData.pcBuilder) {
      console.log('Scraping PC Builder data...');
      cachedData.pcBuilder = await scrapePCBuilder();
      cachedData.lastUpdated = new Date();
    }
    
    res.json({
      compatibilityData: cachedData.pcBuilder.compatibilityData,
      lastUpdated: cachedData.lastUpdated,
    });
  } catch (error) {
    console.error('Error fetching compatibility data:', error);
    res.status(500).json({ error: 'Failed to fetch compatibility data' });
  }
});

/**
 * GET /api/stats - Get scraping statistics
 */
app.get('/api/stats', (req, res) => {
  res.json({
    lastUpdated: cachedData.lastUpdated,
    cached: {
      pcBuilder: cachedData.pcBuilder !== null,
      bundles: cachedData.bundles !== null,
    },
    stats: {
      categories: cachedData.pcBuilder?.categories?.length || 0,
      bundles: cachedData.bundles?.bundles?.length || 0,
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  await loadCachedData();
  
  app.listen(PORT, () => {
    console.log(`\n🚀 Microcenter PC Builder Scraper API`);
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`📊 Last data update: ${cachedData.lastUpdated || 'Never'}\n`);
    console.log('Available endpoints:');
    console.log('  GET  /');
    console.log('  GET  /api/categories');
    console.log('  GET  /api/bundles');
    console.log('  GET  /api/component/:sku');
    console.log('  GET  /api/compatibility');
    console.log('  GET  /api/stats');
    console.log('  POST /api/refresh\n');
  });
}

startServer();

module.exports = app;
