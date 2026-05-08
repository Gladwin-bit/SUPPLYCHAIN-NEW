// src/utils/blockchain.js
// Product verification via BACKEND API — no ethers, no blockchain node on phone.
//
// ARCHITECTURE CHANGE: Instead of calling the blockchain directly from the
// mobile app (which required ethers → @noble/hashes → TurboModule crash),
// we now call our own backend API which does the blockchain read on the server.
//
// Benefits:
//   ✅ No ethers on the phone → no TurboModule crash
//   ✅ Works in Expo Go without native build
//   ✅ Faster (backend RPC is closer to blockchain)
//   ✅ Scratch code hash is verified server-side (more secure)

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Verify a product's authenticity by checking the scratch code against the blockchain.
 * Calls the backend /api/verify/check endpoint which does the ethers work server-side.
 *
 * @param {string|number} productId - The product ID (numeric or formatted like "KS-000001")
 * @param {string} scratchCode - The plaintext scratch-off code
 * @returns {{ verified: boolean, alreadyClaimed: boolean, product: object }}
 */
export async function verifyProduct(productId, scratchCode) {
  // Parse product ID — support "KS-000001", "#1", "1", etc.
  let numericId;
  const idStr = String(productId).trim();
  if (idStr.toUpperCase().startsWith('KS-')) {
    numericId = parseInt(idStr.slice(3), 10);
  } else if (idStr.startsWith('#')) {
    numericId = parseInt(idStr.slice(1), 10);
  } else {
    numericId = parseInt(idStr, 10);
  }

  if (isNaN(numericId) || numericId <= 0) {
    throw new Error(`Invalid product ID: "${productId}"`);
  }

  const token = await AsyncStorage.getItem('token');
  const response = await axios.post(
    `${API_URL}/verify/check`,
    {
      productId: numericId,
      secretCode: scratchCode,
    },
    token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined
  );

  if (!response.data.success) {
    throw new Error(response.data.message || 'Verification failed');
  }

  return {
    verified: response.data.verified,
    alreadyClaimed: response.data.alreadyClaimed,
    product: response.data.product,
  };
}
