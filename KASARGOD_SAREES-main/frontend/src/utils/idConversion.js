// Utility functions for ID format conversions
// Handles conversion between formatted IDs (A, B, A1, A2) and numeric IDs

/**
 * Convert letters to number (A->1, B->2, Z->26, AA->27, AB->28, etc.)
 * @param {string} letters - The letters to convert (A, B, AA, etc.)
 * @return {number} The numeric representation
 */
export const lettersToNumber = (letters) => {
    if (!letters || typeof letters !== 'string') {
        return 0;
    }

    const upperLetters = letters.toUpperCase();
    let result = 0;
    const base = 26;

    for (let i = 0; i < upperLetters.length; i++) {
        const char = upperLetters[i];
        if (char < 'A' || char > 'Z') {
            return 0; // Invalid character
        }

        const value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
        result = result * base + value;
    }

    return result;
};

/**
 * Convert number to letters (1->A, 2->B, 27->AA, 28->AB, etc.)
 * @param {number} num - The number to convert (1-based)
 * @return {string} The letter representation
 */
export const numberToLetters = (num) => {
    if (num <= 0) return '';

    let result = '';
    let n = num - 1; // Convert to 0-based

    do {
        result = String.fromCharCode(65 + (n % 26)) + result;
        n = Math.floor(n / 26);
    } while (n > 0);

    return result;
};

/**
 * Parse a formatted ID and determine its type and components
 * @param {string} formattedId - The formatted ID (e.g., "#1", "A", "A1", "B2")
 * @return {object} Parsed ID info: { type, batchId, productPosition, numericId }
 */
export const parseFormattedId = (formattedId) => {
    if (!formattedId || typeof formattedId !== 'string') {
        return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
    }

    const trimmedId = formattedId.trim();

    // Single product: #1, #2, #3...
    if (trimmedId.startsWith('#')) {
        const numericPart = trimmedId.substring(1);
        const numericId = parseInt(numericPart, 10);

        if (isNaN(numericId) || numericId <= 0) {
            return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
        }

        return {
            type: 'single',
            batchId: null,
            productPosition: null,
            numericId: numericId
        };
    }

    // Check for bulk product: A1, A2, B1, B2...
    const bulkMatch = trimmedId.match(/^([A-Z]+)(\d+)$/);
    if (bulkMatch) {
        const batchLetters = bulkMatch[1];
        const position = parseInt(bulkMatch[2], 10);
        const batchId = lettersToNumber(batchLetters);

        if (batchId <= 0 || position <= 0) {
            return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
        }

        return {
            type: 'bulk_product',
            batchId: batchId,
            productPosition: position,
            numericId: null // Will need to be resolved from batch
        };
    }

    // Batch ID: A, B, C...
    const batchMatch = trimmedId.match(/^[A-Z]+$/);
    if (batchMatch) {
        const batchId = lettersToNumber(trimmedId);

        if (batchId <= 0) {
            return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
        }

        return {
            type: 'batch',
            batchId: batchId,
            productPosition: null,
            numericId: null
        };
    }

    // If nothing matches, try parsing as a plain number
    const directNumeric = parseInt(trimmedId, 10);
    if (!isNaN(directNumeric) && directNumeric > 0) {
        return {
            type: 'numeric',
            batchId: null,
            productPosition: null,
            numericId: directNumeric
        };
    }

    return { type: 'invalid', batchId: null, productPosition: null, numericId: null };
};

/**
 * Resolve a bulk product ID (A1, A2, etc.) to its numeric ID
 * This requires calling the smart contract to get the batch's product IDs
 * @param {number} batchId - The numeric batch ID
 * @param {number} position - The position within the batch (1-based)
 * @param {object} contract - The smart contract instance
 * @return {Promise<number|null>} The numeric product ID or null if not found
 */
export const resolveBulkProductId = async (batchId, position, contract) => {
    try {
        if (!contract) {
            console.error('No contract provided to resolveBulkProductId');
            return null;
        }

        // Get batch data from contract
        const batch = await contract.batches(batchId);

        if (!batch.exists || !batch.productIds || batch.productIds.length === 0) {
            console.error(`Batch ${batchId} does not exist or has no products`);
            return null;
        }

        // Position is 1-based, array is 0-based
        const arrayIndex = position - 1;

        if (arrayIndex < 0 || arrayIndex >= batch.productIds.length) {
            console.error(`Position ${position} is out of range for batch ${batchId} (has ${batch.productIds.length} products)`);
            return null;
        }

        const productId = batch.productIds[arrayIndex];
        return parseInt(productId.toString(), 10);

    } catch (error) {
        console.error('Error resolving bulk product ID:', error);
        return null;
    }
};

/**
 * Convert formatted ID to numeric ID for blockchain queries
 * @param {string} formattedId - The formatted ID
 * @param {object} contract - The smart contract instance (needed for bulk product resolution)
 * @return {Promise<number|null>} The numeric ID for blockchain queries
 */
export const formattedIdToNumeric = async (formattedId, contract) => {
    const parsed = parseFormattedId(formattedId);

    switch (parsed.type) {
        case 'single':
        case 'numeric':
            return parsed.numericId;

        case 'batch':
            return parsed.batchId;

        case 'bulk_product':
            return await resolveBulkProductId(parsed.batchId, parsed.productPosition, contract);

        case 'invalid':
        default:
            return null;
    }
};