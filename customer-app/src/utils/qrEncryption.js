// customer-app/src/utils/qrEncryption.js
// AES-256-CBC decrypt for QR payloads — React Native / Expo Go compatible.
// Uses CryptoJS (pure JavaScript, no native modules needed).
// The shared key comes from EXPO_PUBLIC_QR_ENCRYPTION_KEY in customer-app/.env
//
// The customer app only DECRYPTS — QR codes are never generated here.
// Format: "ENC:<base64(16-byte-iv + ciphertext)>"

import CryptoJS from 'crypto-js';

const ENC_PREFIX = 'ENC:';
const KEY_HEX = process.env.EXPO_PUBLIC_QR_ENCRYPTION_KEY || '';

/**
 * Decrypt a QR payload that was encrypted by the frontend/backend.
 * If the payload does not start with "ENC:" it is returned as-is (backward compat).
 *
 * @param {string} payload - The raw string read from the QR code scanner.
 * @returns {string} - Decrypted plaintext, or original payload on failure/legacy.
 */
export function decryptQR(payload) {
    if (!payload || !payload.startsWith(ENC_PREFIX)) {
        return payload; // legacy plain-text QR — pass through unchanged
    }

    try {
        if (!KEY_HEX) {
            console.warn('[QR-App] EXPO_PUBLIC_QR_ENCRYPTION_KEY not set — cannot decrypt QR!');
            return payload;
        }

        const b64 = payload.slice(ENC_PREFIX.length);
        // Decode base64 → WordArray
        const combined = CryptoJS.enc.Base64.parse(b64);

        // First 16 bytes (4 words × 4 bytes) = IV, rest = ciphertext
        const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, 4), 16);
        const ciphertextWords = CryptoJS.lib.WordArray.create(
            combined.words.slice(4),
            combined.sigBytes - 16
        );

        // Key: hex string → WordArray (32 bytes = 256 bits)
        const keyWordArray = CryptoJS.enc.Hex.parse(KEY_HEX);

        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertextWords },
            keyWordArray,
            {
                iv:      iv,
                mode:    CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7,
            }
        );

        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (err) {
        console.error('[QR-App] Decryption failed:', err);
        return payload; // graceful fallback
    }
}
