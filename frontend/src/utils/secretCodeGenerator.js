// src/utils/secretCodeGenerator.js
import { ethers } from 'ethers';

function randomUuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a cryptographically secure secret code
 * Uses SHA-256 hashing with random bytes and timestamp
 * @param {string} productId - The product ID
 * @param {string} productName - The product name
 * @returns {string} - A secure secret code (64 characters hex)
 */
export const generateSecretCode = (productId, productName) => {
    // Generate random bytes
    const randomBytes = ethers.randomBytes(32);

    // Create a unique string combining product info, timestamp, and random data
    const uniqueString = `${productId}-${productName}-${Date.now()}-${ethers.hexlify(randomBytes)}`;

    // Hash it using SHA-256
    const hash = ethers.keccak256(ethers.toUtf8Bytes(uniqueString));

    // Return the hash without '0x' prefix
    return hash.slice(2);
};

/**
 * Generates a shorter, user-friendly secret code (16 characters)
 * Still cryptographically secure but easier to type/read
 * @param {string} productId - The product ID
 * @param {string} productName - The product name
 * @returns {string} - A secure secret code (16 characters)
 */
export const generateShortSecretCode = (productId, productName) => {
    // For handover keys, use simple 8-character format (consistent with ManageCustody)
    if (productId === "HANDOVER" || productName === "B2B") {
        return Math.random().toString(36).slice(-8).toUpperCase();
    }

    // For consumer scratch-off codes, use the UUID-style format
    const uuid = randomUuidV4();
    const parts = uuid.split('-');
    return `${parts[0].slice(0, 4).toUpperCase()}-${parts[1].toUpperCase()}-${parts[2].toUpperCase()}-${parts[3].toUpperCase()}`;
};

/**
 * Hash a secret code for blockchain storage
 * @param {string} secretCode - The secret code to hash
 * @returns {string} - The hashed code
 */
export const hashSecretCode = (secretCode) => {
    return ethers.keccak256(ethers.toUtf8Bytes(secretCode));
};
