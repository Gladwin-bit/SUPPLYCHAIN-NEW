// src/shims/noble-crypto-shim.js
// Shim for @noble/hashes/crypto in React Native (new architecture / TurboModules)
//
// The @noble/hashes package tries to detect the Web Crypto API via globalThis.crypto.
// In React Native 0.76+ with TurboModules, this detection crashes because
// PlatformConstants hasn't been registered yet when @noble/hashes first loads.
//
// This shim is injected by metro.config.js to replace @noble/hashes/crypto
// with a React Native safe implementation that uses react-native-get-random-values.

// react-native-get-random-values patches globalThis.crypto, so we just expose it.
// App.js imports react-native-get-random-values first, ensuring it's ready.
const rngrv = require('react-native-get-random-values');

const cryptoShim = {
  getRandomValues: rngrv.getRandomValues || ((arr) => {
    // Fallback: use the polyfilled globalThis.crypto
    if (globalThis.crypto && globalThis.crypto.getRandomValues) {
      return globalThis.crypto.getRandomValues(arr);
    }
    throw new Error('No crypto.getRandomValues available');
  }),
  randomUUID: rngrv.randomUUID || (() => {
    // Simple UUID v4 fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }),
};

module.exports = { crypto: cryptoShim };
