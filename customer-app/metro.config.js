// metro.config.js
// Custom Metro bundler configuration for Kasaragod Sarees Customer App

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Shim @noble/hashes/crypto for React Native compatibility ─────────────────
// ethers v6 uses @noble/hashes which calls TurboModuleRegistry.getEnforcing(
// 'PlatformConstants') at load time in RN 0.76+ new architecture — crashing
// before the JS runtime is fully initialized.
// We intercept ALL paths that resolve to @noble/hashes/crypto and redirect to
// a safe React Native shim.

const SHIM_PATH = path.resolve(__dirname, 'src/shims/noble-crypto-shim.js');
const NOBLE_HASHES_DIR = path.resolve(__dirname, 'node_modules/@noble/hashes');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isDirectImport =
    moduleName === '@noble/hashes/crypto' ||
    moduleName === '@noble/hashes/crypto.js';

  // Also catch relative imports like ./crypto.js from WITHIN @noble/hashes
  const isRelativeFromNoble =
    (moduleName === './crypto.js' || moduleName === './crypto') &&
    context.originModulePath &&
    context.originModulePath.includes(path.join('node_modules', '@noble', 'hashes'));

  if (isDirectImport || isRelativeFromNoble) {
    return {
      filePath: SHIM_PATH,
      type: 'sourceFile',
    };
  }

  // Default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
