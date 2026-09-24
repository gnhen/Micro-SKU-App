/**
 * Shared barcode data processor.
 * Used by the Scan screen (index.tsx) and the List screen (list.tsx).
 * Also used by the old app.js (which is dead code).
 */

/**
 * Process raw barcode/QR data into a usable SKU or URL.
 * @param {string} raw - Raw barcode string
 * @returns {string | { value: string, isUPC: true } | { value: string, isURL: true }}
 */
export function processBarcodeData(raw) {
  if (typeof raw !== 'string') return String(raw ?? '');

  // Aggressively clean invisible characters which might mess up regex/length checks
  const trimmedData = raw.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  const charCount = trimmedData.length;

  // 1. URL Check
  if (trimmedData.toLowerCase().includes('microcenter.com')) {
    return { value: trimmedData, isURL: true };
  }

  // 2. Exact 6 digits Check (Direct SKU)
  if (/^\d{6}$/.test(trimmedData)) {
    return trimmedData;
  }

  // 3. Special Internal Code (7-10 characters)
  // Examples: "75007500df", "75007583df"
  // Logic: If it starts with 6 digits and is within this length range, pull the SKU.
  if (charCount >= 7 && charCount <= 10) {
    const startsWithSixDigits = /^\d{6}/.test(trimmedData);
    if (startsWithSixDigits) {
      return trimmedData.substring(0, 6);
    }
  }

  // 4. UPC / Long Code Check ( > 10 characters )
  // Example: "824142287309"
  if (charCount > 10) {
    return { value: trimmedData, isUPC: true };
  }

  // Fallback
  return trimmedData;
}
