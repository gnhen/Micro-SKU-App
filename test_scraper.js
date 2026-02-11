const fs = require('fs');

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
  
  const installPattern = /<(?:input|button)[^>]*data-name="([^"]*Installation Service[^"]*)"[^>]*data-price="([0-9.]+)"/gi;
  let match;
  
  while ((match = installPattern.exec(html)) !== null) {
    const name = decodeHtml(match[1]);
    const price = parseFloat(match[2]);
    installations.push({ name, price });
    console.log('Found installation:', name, price);
  }
  
  return installations;
};

const extractProtectionPlans = (html) => {
  const plans = [];
  
  const radioPattern = /<input[^>]*type="radio"[^>]*data-name="([^"]*(?:Year|Protection|Extended|Extension)[^"]*Plan[^"]*)"[^>]*data-price\s*=\s*"([0-9.]+)"/gi;
  let match;
  
  while ((match = radioPattern.exec(html)) !== null) {
    const name = decodeHtml(match[1]);
    const price = parseFloat(match[2]);
    if (!plans.some(p => p.name === name && p.price === price)) {
      plans.push({ name, price });
      console.log('Found plan:', name, price);
    }
  }
  
  return plans;
};

// Test with the HTML file
const html = fs.readFileSync('MicroScraper/test_product.html', 'utf-8');

console.log('\n=== Testing Full HTML ===');
const installations = extractProInstallation(html);
const plans = extractProtectionPlans(html);

console.log('\nTotal Installations:', installations.length);
console.log('Total Plans:', plans.length);

// Find product title
const nameMatch = html.match(/<h2[^>]*class=['"]productTi['"][^>]*>([^<]+)<\/h2>/i);
if (nameMatch) {
  console.log('\nProduct Title found at index:', nameMatch.index);
  const contentHtml = html.substring(nameMatch.index);
  
  console.log('\n=== Testing Content After Title ===');
  const installationsAfter = extractProInstallation(contentHtml);
  const plansAfter = extractProtectionPlans(contentHtml);
  
  console.log('Installations after title:', installationsAfter.length);
  console.log('Plans after title:', plansAfter.length);
}
