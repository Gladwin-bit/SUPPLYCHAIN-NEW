// src/utils/idConversion.js
// Ported directly from web app's idConversion.js - no changes needed

export const lettersToNumber = (letters) => {
  if (!letters || typeof letters !== 'string') return 0;
  const upperLetters = letters.toUpperCase();
  let result = 0;
  const base = 26;
  for (let i = 0; i < upperLetters.length; i++) {
    const char = upperLetters[i];
    if (char < 'A' || char > 'Z') return 0;
    const value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    result = result * base + value;
  }
  return result;
};

export const numberToLetters = (num) => {
  if (num <= 0) return '';
  let result = '';
  let n = num - 1;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  } while (n > 0);
  return result;
};

export const parseFormattedId = (formattedId) => {
  if (!formattedId || typeof formattedId !== 'string') {
    return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
  }
  const trimmedId = formattedId.trim();

  // Single product: #1, #2, #3
  if (trimmedId.startsWith('#')) {
    const numericId = parseInt(trimmedId.substring(1), 10);
    if (isNaN(numericId) || numericId <= 0) {
      return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
    }
    return { type: 'single', batchId: null, productPosition: null, numericId };
  }

  // Bulk product: A1, A2, B1, B2
  const bulkMatch = trimmedId.match(/^([A-Z]+)(\d+)$/);
  if (bulkMatch) {
    const batchId = lettersToNumber(bulkMatch[1]);
    const position = parseInt(bulkMatch[2], 10);
    if (batchId <= 0 || position <= 0) {
      return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
    }
    return { type: 'bulk_product', batchId, productPosition: position, numericId: null };
  }

  // Batch ID: A, B, C
  const batchMatch = trimmedId.match(/^[A-Z]+$/);
  if (batchMatch) {
    const batchId = lettersToNumber(trimmedId);
    if (batchId <= 0) {
      return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
    }
    return { type: 'batch', batchId, productPosition: null, numericId: null };
  }

  // Plain number
  const directNumeric = parseInt(trimmedId, 10);
  if (!isNaN(directNumeric) && directNumeric > 0) {
    return { type: 'numeric', batchId: null, productPosition: null, numericId: directNumeric };
  }

  return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
};
