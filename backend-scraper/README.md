# Microcenter PC Builder Scraper Backend

Backend service that scrapes Microcenter's PC Builder and Bundle pages to extract component data, compatibility rules, and bundle configurations. Provides a REST API for the mobile app to consume.

## Features

- 🔍 Scrapes PC Builder page for component categories and compatibility rules
- 📦 Extracts bundle configurations from Bundle & Save pages
- 🛠️ Fetches detailed component specifications by SKU
- ⚡ Caches data to minimize scraping frequency
- 🌐 REST API for mobile app integration

## Prerequisites

- Node.js 16+ and npm
- Chrome/Chromium (for Puppeteer)

## Installation

```bash
cd backend-scraper
npm install
```

## Usage

### Run the Scraper (One-time)

Extract all data and save to JSON files:

```bash
npm run scrape
```

This will:
- Scrape PC Builder page for categories and compatibility
- Scrape Bundle & Save pages for pre-configured bundles
- Save data to `./data/` directory
- Save screenshots to `./screenshots/` directory

### Start the API Server

```bash
npm start
```

Server runs on `http://localhost:3000`

### Development Mode (Auto-restart)

```bash
npm run dev
```

## API Endpoints

### `GET /`
Health check and server status

**Response:**
```json
{
  "status": "online",
  "service": "Microcenter PC Builder Scraper API",
  "version": "1.0.0",
  "lastUpdated": "2026-02-13T..."
}
```

### `GET /api/categories`
Get all component categories

**Response:**
```json
{
  "categories": [
    {
      "name": "cpu",
      "displayName": "CPU (Processor)",
      "order": 0
    },
    ...
  ],
  "lastUpdated": "2026-02-13T..."
}
```

### `GET /api/bundles`
Get all available bundles

**Response:**
```json
{
  "bundles": [
    {
      "name": "Intel i5 Gaming Bundle",
      "description": "...",
      "totalPrice": "$899.99",
      "bundlePrice": "$799.99",
      "components": [
        { "sku": "123456", "name": "Intel Core i5-14600K" },
        ...
      ]
    },
    ...
  ],
  "count": 15,
  "lastUpdated": "2026-02-13T..."
}
```

### `GET /api/component/:sku`
Get detailed component information by SKU

**Parameters:**
- `sku` - Microcenter SKU (numeric)

**Response:**
```json
{
  "component": {
    "name": "Intel Core i7-14700K",
    "brand": "Intel",
    "price": "$419.99",
    "sku": "123456",
    "imageUrl": "https://...",
    "specs": {
      "socket": "LGA1700",
      "cores": "20",
      "tdp": "125W",
      ...
    }
  },
  "scrapedAt": "2026-02-13T..."
}
```

### `GET /api/compatibility`
Get compatibility rules extracted from PC Builder

**Response:**
```json
{
  "compatibilityData": [
    {
      "type": "sockets",
      "values": ["LGA1700", "AM5", "AM4"]
    },
    {
      "type": "memory_types",
      "values": ["DDR4", "DDR5"]
    },
    ...
  ],
  "lastUpdated": "2026-02-13T..."
}
```

### `POST /api/refresh`
Force refresh all cached data (scrapes all pages again)

**Response:**
```json
{
  "success": true,
  "message": "Data refreshed successfully",
  "lastUpdated": "2026-02-13T...",
  "stats": {
    "categories": 10,
    "bundles": 15
  }
}
```

### `GET /api/stats`
Get current cache statistics

**Response:**
```json
{
  "lastUpdated": "2026-02-13T...",
  "cached": {
    "pcBuilder": true,
    "bundles": true
  },
  "stats": {
    "categories": 10,
    "bundles": 15
  }
}
```

## Data Structure

### Saved Files

- `data/pc-builder-data.json` - Component categories and compatibility rules
- `data/bundle-data.json` - Bundle configurations and pricing
- `screenshots/*.png` - Page screenshots for reference

## Integration with Mobile App

The mobile app can call these endpoints to:

1. Fetch component categories on startup
2. Load bundle configurations
3. Get detailed component specs when scanning SKUs
4. Check compatibility rules for builds

Example usage in the mobile app:

```javascript
// In MicroScraper/services/backendApi.js
const API_URL = 'http://your-server-ip:3000';

export async function fetchBundles() {
  const response = await fetch(`${API_URL}/api/bundles`);
  return await response.json();
}

export async function fetchComponentDetails(sku) {
  const response = await fetch(`${API_URL}/api/component/${sku}`);
  return await response.json();
}
```

## Rate Limiting

The scraper includes delays to avoid triggering Microcenter's bot detection:
- 3 second delay after page load
- 2 second delay between bundle page scrapes

## Troubleshooting

### Puppeteer fails to launch
Install Chrome/Chromium dependencies:
```bash
# Ubuntu/Debian
sudo apt-get install -y chromium-browser

# Or use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Scraping returns empty data
- Check if Microcenter changed their HTML structure
- View saved screenshots in `./screenshots/` to debug
- Try increasing delays in scraper.js

### CORS errors in mobile app
Enable CORS in server.js (already configured) and ensure you're using the correct server IP

## Future Enhancements

- [ ] Add scheduled auto-refresh (daily scraping)
- [ ] Implement component search by name/keyword
- [ ] Add component image caching
- [ ] Store data in PostgreSQL instead of JSON files
- [ ] Add authentication for API endpoints
- [ ] Implement webhook notifications when bundles change

## License

MIT
