#!/usr/bin/env node
// Run this script whenever assets/071/storedatfile.csv is updated:
//   node scripts/buildStore071Lookup.js

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../assets/071/storedatfile.csv');
const outPath = path.join(__dirname, '../constants/store071Lookup.ts');

const normalizeCell = (value) => String(value ?? '').trim();

const normalizeSku = (value) => {
  const text = normalizeCell(value);
  if (!text) return '';
  if (/^\d+\.0+$/.test(text)) {
    return text.replace(/\.0+$/, '');
  }
  return text;
};

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);

const lookup = {};
const lookupAll = {};
let totalRows = 0;
let mappedRows = 0;

for (const line of lines) {
  totalRows += 1;

  const cols = line.split(',');

  const col2 = normalizeCell(cols[1]);
  const col3 = normalizeCell(cols[2]);
  const sku = normalizeSku(cols[3]);

  if (!sku) continue;

  // Skip header-like rows
  if (sku.toLowerCase() === 'sku') continue;

  const mergedCode = `${col2}${col3}`;
  if (!mergedCode) continue;

  if (!lookupAll[sku]) lookupAll[sku] = [];
  if (!lookupAll[sku].includes(mergedCode)) {
    lookupAll[sku].push(mergedCode);
  }

  // First row wins for duplicate SKUs
  if (lookup[sku] !== undefined) continue;

  lookup[sku] = mergedCode;
  mappedRows += 1;
}

const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

let out = `// Auto-generated from assets/071/storedatfile.csv — do not edit manually
// Regenerate with: node scripts/buildStore071Lookup.js

const STORE_071_LOOKUP: Record<string, string> = {
`;

for (const sku of Object.keys(lookup)) {
  out += `  '${escape(sku)}': '${escape(lookup[sku])}',\n`;
}

out += `};

const STORE_071_LOOKUP_ALL: Record<string, string[]> = {
`;

for (const sku of Object.keys(lookupAll)) {
  const codes = lookupAll[sku].map(code => `'${escape(code)}'`).join(', ');
  out += `  '${escape(sku)}': [${codes}],\n`;
}

out += `};

function normalizeLookupSku(sku: string): string {
  const text = String(sku ?? '').trim();
  return text.replace(/\\.0+$/, '');
}

export function lookupStore071MergedCode(sku: string): string | null {
  const normalizedSku = normalizeLookupSku(sku);
  if (!normalizedSku) return null;
  return STORE_071_LOOKUP[normalizedSku] ?? null;
}

export function lookupStore071MergedCodes(sku: string): string[] {
  const normalizedSku = normalizeLookupSku(sku);
  if (!normalizedSku) return [];
  return STORE_071_LOOKUP_ALL[normalizedSku] ?? [];
}
`;

fs.writeFileSync(outPath, out);
console.log(`Parsed ${totalRows} rows from storedatfile.csv; wrote ${Object.keys(lookup).length} unique SKU entries to constants/store071Lookup.ts`);
