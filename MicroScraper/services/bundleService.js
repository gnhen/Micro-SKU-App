import { detectBundle, getAllBundles } from './database';

/**
 * Bundle detection and pricing service
 * Analyzes a collection of components to identify matching bundles and calculate savings
 */

/**
 * Check if current build components match any available bundles
 * @param {Array} components - Array of component objects with id, sku, category_name, price, sale_price
 * @returns {Object} - Bundle match information with savings details
 */
export const checkForBundleMatch = async (components) => {
  if (!components || components.length === 0) {
    return {
      hasBundle: false,
      bundles: [],
      savings: 0,
      totalPrice: 0,
      bundlePrice: 0,
    };
  }

  const componentIds = components.map(c => c.id);
  const matchedBundles = await detectBundle(componentIds);

  if (matchedBundles.length === 0) {
    return {
      hasBundle: false,
      bundles: [],
      savings: 0,
      totalPrice: calculateTotalPrice(components),
      bundlePrice: 0,
    };
  }

  // Sort bundles by savings (highest first)
  matchedBundles.sort((a, b) => (b.savings || 0) - (a.savings || 0));
  const bestBundle = matchedBundles[0];

  return {
    hasBundle: true,
    bundles: matchedBundles,
    bestBundle: bestBundle,
    savings: bestBundle.savings || 0,
    totalPrice: bestBundle.total_price || 0,
    bundlePrice: bestBundle.bundle_price || 0,
  };
};

/**
 * Calculate the total price of components (using sale prices when available)
 * @param {Array} components - Array of component objects
 * @returns {Number} - Total price
 */
export const calculateTotalPrice = (components) => {
  return components.reduce((total, component) => {
    const price = component.sale_price || component.price || 0;
    const quantity = component.quantity || 1;
    return total + (price * quantity);
  }, 0);
};

/**
 * Calculate individual component prices vs bundle pricing
 * @param {Array} components - Components in the build
 * @param {Object} bundle - Bundle object
 * @returns {Object} - Detailed pricing breakdown
 */
export const calculatePricingBreakdown = (components, bundle) => {
  const individualTotal = calculateTotalPrice(components);
  const bundlePrice = bundle?.bundle_price || individualTotal;
  const savings = individualTotal - bundlePrice;

  return {
    individualTotal,
    bundlePrice,
    savings,
    savingsPercentage: individualTotal > 0 ? ((savings / individualTotal) * 100).toFixed(1) : 0,
    components: components.map(c => ({
      name: c.name,
      sku: c.sku,
      individualPrice: c.sale_price || c.price || 0,
      quantity: c.quantity || 1,
      subtotal: (c.sale_price || c.price || 0) * (c.quantity || 1),
    })),
  };
};

/**
 * Find partial bundle matches (when some but not all bundle components are in the build)
 * @param {Array} components - Current build components
 * @returns {Array} - Array of partial bundle matches with missing components
 */
export const findPartialBundles = async (components) => {
  const allBundles = await getAllBundles();
  const componentIds = components.map(c => c.id);
  const partialMatches = [];

  for (const bundle of allBundles) {
    const bundleComponentIds = bundle.components.map(c => c.id);
    const matchingCount = bundleComponentIds.filter(id => componentIds.includes(id)).length;
    
    // If some but not all components match
    if (matchingCount > 0 && matchingCount < bundleComponentIds.length) {
      const missingComponents = bundle.components.filter(c => !componentIds.includes(c.id));
      
      partialMatches.push({
        bundle,
        matchingCount,
        totalComponents: bundleComponentIds.length,
        completionPercentage: ((matchingCount / bundleComponentIds.length) * 100).toFixed(0),
        missingComponents,
        potentialSavings: bundle.savings || 0,
      });
    }
  }

  // Sort by completion percentage
  partialMatches.sort((a, b) => b.completionPercentage - a.completionPercentage);
  
  return partialMatches;
};

/**
 * Suggest bundle upgrades - find bundles that include current components plus extras
 * @param {Array} components - Current build components
 * @returns {Array} - Array of bundle suggestions
 */
export const suggestBundleUpgrades = async (components) => {
  const allBundles = await getAllBundles();
  const componentSkus = new Set(components.map(c => c.sku));
  const suggestions = [];

  for (const bundle of allBundles) {
    const bundleSkus = new Set(bundle.components.map(c => c.sku));
    
    // Check if all current components are in the bundle
    const allIncluded = [...componentSkus].every(sku => bundleSkus.has(sku));
    
    if (allIncluded && bundleSkus.size > componentSkus.size) {
      const additionalComponents = bundle.components.filter(c => !componentSkus.has(c.sku));
      const additionalCost = additionalComponents.reduce((sum, c) => 
        sum + (c.sale_price || c.price || 0), 0
      );
      
      suggestions.push({
        bundle,
        additionalComponents,
        additionalCost,
        totalSavings: bundle.savings || 0,
        netSavings: (bundle.savings || 0) - additionalCost,
        worthIt: ((bundle.savings || 0) - additionalCost) > 0,
      });
    }
  }

  // Sort by net savings
  suggestions.sort((a, b) => b.netSavings - a.netSavings);
  
  return suggestions;
};

/**
 * Format pricing information for display
 * @param {Number} price - Price to format
 * @returns {String} - Formatted price string
 */
export const formatPrice = (price) => {
  if (typeof price !== 'number') return '$0.00';
  return `$${price.toFixed(2)}`;
};

/**
 * Generate a shareable text summary of a build
 * @param {Object} build - Build object with components
 * @param {Object} bundleInfo - Optional bundle information
 * @returns {String} - Formatted text summary
 */
export const generateBuildSummary = (build, bundleInfo = null) => {
  let summary = `=== ${build.name} ===\n\n`;
  
  if (bundleInfo?.hasBundle) {
    summary += `🎁 BUNDLE: ${bundleInfo.bestBundle.name}\n`;
    summary += `💰 Total Savings: ${formatPrice(bundleInfo.savings)}\n\n`;
  }
  
  summary += 'COMPONENTS:\n';
  summary += '─'.repeat(50) + '\n';
  
  const groupedComponents = {};
  for (const component of build.components || []) {
    if (!groupedComponents[component.category_display]) {
      groupedComponents[component.category_display] = [];
    }
    groupedComponents[component.category_display].push(component);
  }
  
  for (const [category, components] of Object.entries(groupedComponents)) {
    summary += `\n${category}:\n`;
    for (const component of components) {
      const price = component.sale_price || component.price || 0;
      summary += `  • ${component.name}\n`;
      summary += `    ${formatPrice(price)}`;
      if (component.quantity > 1) {
        summary += ` x ${component.quantity}`;
      }
      if (component.sale_price && component.sale_price < component.price) {
        summary += ` (was ${formatPrice(component.price)})`;
      }
      summary += '\n';
    }
  }
  
  summary += '\n' + '─'.repeat(50) + '\n';
  summary += `TOTAL: ${formatPrice(bundleInfo?.bundlePrice || build.total_price || 0)}\n`;
  
  if (bundleInfo?.hasBundle) {
    summary += `Regular Price: ${formatPrice(bundleInfo.totalPrice)}\n`;
    summary += `You Save: ${formatPrice(bundleInfo.savings)}\n`;
  }
  
  summary += '\n' + new Date().toLocaleDateString();
  
  return summary;
};

export default {
  checkForBundleMatch,
  calculateTotalPrice,
  calculatePricingBreakdown,
  findPartialBundles,
  suggestBundleUpgrades,
  formatPrice,
  generateBuildSummary,
};
