#!/usr/bin/env node
// Run this script whenever assets/071/storemap.pdf is updated:
//   node scripts/buildStore071MapIndex.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const pdfPath = path.join(__dirname, '../assets/071/storemap.pdf');
const mapAssetDir = path.join(__dirname, '../assets/071/storemap');
const imageBasePath = path.join(mapAssetDir, 'storemap-page-1');
const imagePath = `${imageBasePath}.png`;
const outPath = path.join(__dirname, '../constants/store071MapIndex.ts');
const MAP_RENDER_DPI = 200;

const decodeHtmlEntities = (value) => value
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&#x27;/g, "'")
  .replace(/&#x2F;/g, '/');

const normalizeForSearch = (value) => String(value ?? '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

const digitsOnly = (value) => String(value ?? '')
  .replace(/[^0-9]/g, '');

const toNumber = (value) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const escape = (value) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'");

fs.mkdirSync(mapAssetDir, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store071-map-'));
const bboxXmlPath = path.join(tempDir, 'storemap.bbox.xml');

execFileSync('pdftotext', ['-bbox-layout', '-f', '1', '-l', '1', pdfPath, bboxXmlPath], {
  stdio: 'pipe',
});

execFileSync('pdftoppm', ['-png', '-singlefile', '-rx', String(MAP_RENDER_DPI), '-ry', String(MAP_RENDER_DPI), '-f', '1', '-l', '1', pdfPath, imageBasePath], {
  stdio: 'pipe',
});

if (!fs.existsSync(imagePath)) {
  throw new Error(`Expected map image was not generated at ${imagePath}`);
}

const xml = fs.readFileSync(bboxXmlPath, 'utf8');

const pageMatch = xml.match(/<page[^>]*width="([^"]+)"[^>]*height="([^"]+)"/i);
if (!pageMatch) {
  throw new Error('Could not locate page width/height in bbox XML output.');
}

const pageWidth = toNumber(pageMatch[1]);
const pageHeight = toNumber(pageMatch[2]);

const wordRegex = /<word\s+xMin="([^"]+)"\s+yMin="([^"]+)"\s+xMax="([^"]+)"\s+yMax="([^"]+)">([\s\S]*?)<\/word>/g;
const dedupe = new Set();
const entries = [];

let match;
while ((match = wordRegex.exec(xml)) !== null) {
  const rawText = decodeHtmlEntities(match[5]).trim();
  if (!rawText) continue;

  const normalized = normalizeForSearch(rawText);
  const digits = digitsOnly(rawText);
  if (!normalized && !digits) continue;

  const xMin = toNumber(match[1]);
  const yMin = toNumber(match[2]);
  const xMax = toNumber(match[3]);
  const yMax = toNumber(match[4]);

  const key = `${normalized}|${digits}|${xMin.toFixed(3)}|${yMin.toFixed(3)}|${xMax.toFixed(3)}|${yMax.toFixed(3)}`;
  if (dedupe.has(key)) continue;
  dedupe.add(key);

  entries.push({
    text: rawText,
    normalized,
    digits,
    xMin,
    yMin,
    xMax,
    yMax,
  });
}

entries.sort((a, b) => {
  if (a.yMin !== b.yMin) return a.yMin - b.yMin;
  return a.xMin - b.xMin;
});

let out = `// Auto-generated from assets/071/storemap.pdf — do not edit manually
// Regenerate with: node scripts/buildStore071MapIndex.js

export interface Store071MapEntry {
  text: string;
  normalized: string;
  digits: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export const STORE_071_MAP_PAGE_WIDTH = ${pageWidth};
export const STORE_071_MAP_PAGE_HEIGHT = ${pageHeight};
export const STORE_071_MAP_IMAGE = require('../assets/071/storemap/storemap-page-1.png');

export const STORE_071_MAP_IMAGE_WIDTH = ${Math.round(pageWidth * MAP_RENDER_DPI / 72)};
export const STORE_071_MAP_IMAGE_HEIGHT = ${Math.round(pageHeight * MAP_RENDER_DPI / 72)};

const STORE_071_MAP_ENTRIES: Store071MapEntry[] = [
`;

for (const entry of entries) {
  out += `  { text: '${escape(entry.text)}', normalized: '${escape(entry.normalized)}', digits: '${escape(entry.digits)}', xMin: ${entry.xMin.toFixed(3)}, yMin: ${entry.yMin.toFixed(3)}, xMax: ${entry.xMax.toFixed(3)}, yMax: ${entry.yMax.toFixed(3)} },\n`;
}

out += `];

function normalizeMapQuery(value: string): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function digitsOnlyQuery(value: string): string {
  return String(value ?? '').replace(/[^0-9]/g, '');
}

export function findStore071MapEntry(query: string): Store071MapEntry | null {
  return findStore071MapEntries(query)[0] ?? null;
}

export function findStore071MapEntries(query: string): Store071MapEntry[] {
  const normalizedQuery = normalizeMapQuery(query);
  const queryDigits = digitsOnlyQuery(query);

  if (!normalizedQuery && !queryDigits) return [];

  const allMatches = STORE_071_MAP_ENTRIES.filter(entry =>
    (normalizedQuery && entry.normalized.includes(normalizedQuery)) ||
    (queryDigits && entry.digits.includes(queryDigits))
  );

  if (allMatches.length === 0) return [];

  return allMatches.sort((a, b) => {
    const aExact = (normalizedQuery && a.normalized === normalizedQuery) || (queryDigits && a.digits === queryDigits);
    const bExact = (normalizedQuery && b.normalized === normalizedQuery) || (queryDigits && b.digits === queryDigits);

    if (aExact !== bExact) return aExact ? -1 : 1;
    if (a.yMin !== b.yMin) return a.yMin - b.yMin;
    return a.xMin - b.xMin;
  });
}
`;

fs.writeFileSync(outPath, out);
fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`Generated map index with ${entries.length} searchable entries at constants/store071MapIndex.ts`);
console.log(`Generated map image at ${path.relative(path.join(__dirname, '..'), imagePath)}`);
