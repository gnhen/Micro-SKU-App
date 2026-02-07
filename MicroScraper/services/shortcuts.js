// iOS Shortcuts integration
// This module handles donating shortcuts to iOS so they appear in the Shortcuts app

export const donateSearchShortcut = (sku = null) => {
  // For Expo, we use deep linking URLs as the primary integration method
  // The shortcuts will be created using the URL scheme: microscraper://search?sku=X
  
  console.log('Shortcut ready: Search for SKU', sku || 'any');
  
  // Return the URL scheme for use in Shortcuts app
  return {
    search: `microscraper://search?sku=${sku || '{sku}'}`,
    scan: 'microscraper://scan'
  };
};

export const getShortcutInstructions = () => {
  return {
    searchShortcut: {
      name: 'Search Micro Center SKU',
      description: 'Search for a product by SKU number',
      steps: [
        '1. Open Shortcuts app',
        '2. Tap + to create new shortcut',
        '3. Add "Ask for Input" action',
        '   - Prompt: "Enter SKU"',
        '   - Input Type: Number',
        '4. Add "Open URLs" action',
        '   - URL: microscraper://search?sku=',
        '   - Tap after "sku=" and select "Input"',
        '5. Name it "Search Micro Center"',
        '6. Done! You can now use with Siri or in Shortcuts'
      ],
      url: 'microscraper://search?sku='
    },
    scanShortcut: {
      name: 'Scan Micro Center Barcode',
      description: 'Open camera to scan product barcode',
      steps: [
        '1. Open Shortcuts app',
        '2. Tap + to create new shortcut',
        '3. Add "Open URLs" action',
        '   - URL: microscraper://scan',
        '4. Name it "Scan Micro Center"',
        '5. Done! You can now use with Siri or in Shortcuts'
      ],
      url: 'microscraper://scan'
    }
  };
};
