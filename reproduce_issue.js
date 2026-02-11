const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('MicroScraper/test_product.html', 'utf8');

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

const extractProInstallation = (html) => {
  const installations = [];
  
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
  
  // Current Regex in scraper.js
  const radioPattern = /data-name="(\d+\s*Year[^"]*Plan[^"]*)"[^>]*data-price\s*="([0-9.]+)"/gi;
  let match;
  
  while ((match = radioPattern.exec(html)) !== null) {
    const name = decodeHtml(match[1]);
    const price = parseFloat(match[2]);
    if (!plans.some(p => p.name === name && p.price === price)) {
      plans.push({ name, price });
    }
  }
  
  console.log('Extracted protection plans:', plans);
  return plans;
};

console.log('--- contentHtml Simulation ---');
// Simulating contentHtml substring logic from scraper.js
let contentStartIndex = 0;
const nameMatch = html.match(/<h2[^>]*class=['"]productTi['"][^>]*>([^<]+)<\/h2>/i) ||
                  html.match(/<h1[^>]*data-name=['"]([^'"]+)['"]/i) ||
                  html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
if (nameMatch) {
  contentStartIndex = nameMatch.index;
  console.log('Found offset index:', contentStartIndex);
} else {
    console.log('Could not find offset index');
}

const contentHtml = contentStartIndex > 0 ? html.substring(contentStartIndex) : html;

extractProInstallation(contentHtml);
extractProtectionPlans(contentHtml);
