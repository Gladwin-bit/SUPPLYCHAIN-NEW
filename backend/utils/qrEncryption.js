// backend/utils/qrEncryption.js
// AES-256-CBC encryption/decryption for QR code payloads — Node.js side.
// Uses the built-in `node:crypto` module (no external dependency).
// The shared key is set via QR_ENCRYPTION_KEY in backend/.env
// Format: "ENC:<base64(16-byte-iv + ciphertext)>"

import crypto from 'node:crypto';

const ENC_PREFIX = 'ENC:';
const ALGORITHM   = 'aes-256-cbc';
const KEY_HEX     = process.env.QR_ENCRYPTION_KEY || '';

function getKeyBuffer() {
    if (!KEY_HEX) {
        console.warn('[QR-Backend] QR_ENCRYPTION_KEY not set — QR will not be encrypted!');
        return null;
    }
    if (KEY_HEX.length !== 64) {
        throw new Error('QR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Encrypt a string for QR embedding.
 * @param {string} plaintext
 * @returns {string} "ENC:<base64>" or original string if no key configured.
 */
export function encryptForQR(plaintext) {
    try {
        const keyBuf = getKeyBuffer();
        if (!keyBuf) return plaintext;

        const iv         = crypto.randomBytes(16);
        const cipher     = crypto.createCipheriv(ALGORITHM, keyBuf, iv);
        const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const combined   = Buffer.concat([iv, encrypted]);

        return `${ENC_PREFIX}${combined.toString('base64')}`;
    } catch (err) {
        console.error('[QR-Backend] Encryption failed:', err);
        return plaintext; // graceful fallback
    }
}

/**
 * Decrypt a QR payload produced by encryptForQR().
 * Returns plain-text pass-through for legacy (non-"ENC:") payloads.
 * @param {string} payload
 * @returns {string}
 */
export function decryptFromQR(payload) {
    if (!payload || !payload.startsWith(ENC_PREFIX)) {
        return payload; // backward compat
    }
    try {
        const keyBuf   = getKeyBuffer();
        if (!keyBuf) return payload;

        const combined = Buffer.from(payload.slice(ENC_PREFIX.length), 'base64');
        const iv       = combined.slice(0, 16);
        const ciphertext = combined.slice(16);

        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        return decrypted.toString('utf8');
    } catch (err) {
        console.error('[QR-Backend] Decryption failed:', err);
        return payload; // graceful fallback
    }
}
