// src/utils/walletConnect.js
// Method A: WalletConnect / MetaMask deep link
//
// ⚠️  EXPO GO LIMITATION:
//    WalletConnect + ethers require native crypto modules that are incompatible
//    with Expo Go. This method requires a CUSTOM DEV BUILD (EAS build).
//    In Expo Go, it shows a "not available" message.
//
// For full testing use Method B (backend relay) which works in Expo Go.

export const WC_SUPPORTED = false; // Set to true only in a custom/EAS build

export async function connectMetaMask() {
  throw new Error(
    'MetaMask via WalletConnect requires a custom app build (not Expo Go).\n\n' +
    'Use "Claim via Backend" (Method B) to test in Expo Go.\n\n' +
    'To enable WalletConnect, build with: npx eas build --profile preview'
  );
}

export async function sendClaimTransaction() {
  throw new Error('WalletConnect not available in Expo Go. Use backend relay instead.');
}

export async function disconnectWC() {
  // No-op in Expo Go
}
