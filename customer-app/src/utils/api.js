// src/utils/api.js
// React Native version - uses AsyncStorage for token, no window.location
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Uses EXPO_PUBLIC_ prefix for Expo environment variables
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://earnest-love-production-b80e.up.railway.app/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout for mobile networks
});

// Request interceptor - attach JWT token from AsyncStorage
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // AsyncStorage read failed, continue without token
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - clear storage (navigation handled by auth state)
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth API calls (mirrors web app's authAPI)
export const authAPI = {
  register: async (formData) => {
    // For registration with file uploads, use FormData
    const form = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== undefined && formData[key] !== null) {
        form.append(key, formData[key]);
      }
    });

    const response = await api.post('/auth/register', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Batch API (for batch waybill lookups)
export const batchAPI = {
  getBatch: async (batchId) => {
    const response = await api.get(`/batch/${encodeURIComponent(batchId)}`);
    return response.data;
  },

  getBatchAnalytics: async (batchId) => {
    const response = await api.get(`/batch/${encodeURIComponent(batchId)}/analytics`);
    return response.data;
  },
};

// Verify & Claim API (backend relay — Method B)
export const verifyAPI = {
  /**
   * Backend relay claim — backend wallet signs claimOwnership()
   * Requires JWT login (customer must be authenticated)
   * @param {number} productId
   * @param {string} secretCode - plaintext scratch-off code
   * @param {string} location - customer's location
   */
  claim: async (productId, secretCode, location) => {
    const response = await api.post('/verify/claim', {
      productId,
      secretCode,
      location: location || 'Not specified',
    });
    return response.data;
  },

  myProducts: async (limit = 100) => {
    const response = await api.get(`/verify/my-products?limit=${encodeURIComponent(limit)}`);
    return response.data;
  },

  traceProduct: async (productId) => {
    const response = await api.get(`/verify/trace/${encodeURIComponent(productId)}`);
    return response.data;
  },

  syncClaim: async (productId) => {
    const response = await api.post('/verify/sync-claim', { productId });
    return response.data;
  },

  /**
   * Check relayer wallet status (health)
   */
  relayerStatus: async () => {
    const response = await api.get('/verify/relayer-status');
    return response.data;
  },
};

export const certificateAPI = {
  getByProduct: async (productId) => {
    const response = await api.get(`/certificates/${encodeURIComponent(productId)}`);
    return response.data;
  },
};

export const reportsAPI = {
  create: async (payload) => {
    const response = await api.post('/reports', payload);
    return response.data;
  },
};

export default api;

