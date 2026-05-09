// src/utils/qrEncryption.js
// AES-256-CBC encryption/decryption for QR code payloads using the browser Web Crypto API.
// The shared key is set via REACT_APP_QR_ENCRYPTION_KEY in .env
// Encoded format: "ENC:<base64(12-byte-iv + ciphertext)>"
// Backward compatible: plain-text QRs (no "ENC:" prefix) pass through unchanged.

const ENC_PREFIX = 'ENC:';
const RAW_KEY_HEX = process.env.REACT_APP_QR_ENCRYPTION_KEY || '';

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
    if (!hex || hex.length % 2 !== 0) throw new Error('QR_ENCRYPTION_KEY must be a 64-char hex string');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

let _cryptoKey = null;

async function getCryptoKey() {
    if (_cryptoKey) return _cryptoKey;
    if (!RAW_KEY_HEX) {
        console.warn('[QR] REACT_APP_QR_ENCRYPTION_KEY not set — QR content will not be encrypted!');
        return null;
    }
    const keyBytes = hexToBytes(RAW_KEY_HEX);
    _cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC' },
        false,
        ['encrypt', 'decrypt']
    );
    return _cryptoKey;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt a string for embedding inside a QR code.
 * Returns "ENC:<base64>" or the original string if no key is configured.
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
export async function encryptQR(plaintext) {
    try {
        const key = await getCryptoKey();
        if (!key) return plaintext; // no key → pass-through

        const iv = crypto.getRandomValues(new Uint8Array(16)); // AES-CBC needs 16-byte IV
        const encoded = new TextEncoder().encode(plaintext);

        const cipherBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv },
            key,
            encoded
        );

        // Prepend IV to ciphertext, then base64-encode the whole thing
        const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(cipherBuffer), iv.length);

        const b64 = btoa(String.fromCharCode(...combined));
        return `${ENC_PREFIX}${b64}`;
    } catch (err) {
        console.error('[QR] Encryption failed:', err);
        return plaintext; // graceful fallback
    }
}

/**
 * Decrypt a QR payload produced by encryptQR().
 * If the payload does not start with "ENC:", it is returned as-is (backward compat).
 * @param {string} payload
 * @returns {Promise<string>}
 */
export async function decryptQR(payload) {
    if (!payload || !payload.startsWith(ENC_PREFIX)) {
        return payload; // legacy plain-text → pass-through
    }
    try {
        const key = await getCryptoKey();
        if (!key) {
            console.warn('[QR] Cannot decrypt — REACT_APP_QR_ENCRYPTION_KEY not set');
            return payload;
        }

        const b64 = payload.slice(ENC_PREFIX.length);
        const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

        const iv = combined.slice(0, 16);
        const ciphertext = combined.slice(16);

        const plainBuffer = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(plainBuffer);
    } catch (err) {
        console.error('[QR] Decryption failed:', err);
        return payload; // graceful fallback
    }
}
