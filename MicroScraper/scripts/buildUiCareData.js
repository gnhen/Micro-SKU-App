#!/usr/bin/env node
// Run this script whenever assets/data/uicare.csv is updated:
//   node scripts/buildUiCareData.js

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../assets/data/uicare.csv');
const outPath = path.join(__dirname, '../constants/uiCareData.ts');

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.trim().split('\n').slice(1);
const entries = lines.map(line => {
  const cols = line.split(',');
  return {
    sku: cols[0].trim(),
    productDesc: (cols[3] || '').trim(),
    uiCareProduct: (cols[4] || '').trim(),
    uiCarePrice: (cols[5] || '').trim()
  };
}).filter(e => e.sku);

const escape = s => s.replace(/'/g, "\\'");

let out = `// Auto-generated from assets/data/uicare.csv — do not edit manually
// Regenerate with: node scripts/buildUiCareData.js

export interface UiCareEntry {
  sku: string;
  productDesc: string;
  uiCareProduct: string;
  uiCarePrice: string;
}

const UI_CARE_LOOKUP: Record<string, UiCareEntry> = {
`;

entries.forEach(e => {
  out += `  '${escape(e.sku)}': { sku: '${escape(e.sku)}', productDesc: '${escape(e.productDesc)}', uiCareProduct: '${escape(e.uiCareProduct)}', uiCarePrice: '${escape(e.uiCarePrice)}' },\n`;
});

out += `};

export function lookupUiCare(sku: string): UiCareEntry | null {
  return UI_CARE_LOOKUP[sku] ?? null;
}
`;

fs.writeFileSync(outPath, out);
console.log(`Written ${entries.length} entries to constants/uiCareData.ts`);
