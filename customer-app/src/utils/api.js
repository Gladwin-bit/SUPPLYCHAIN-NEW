// src/utils/api.js
// React Native version - uses AsyncStorage for token, no window.location
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Uses EXPO_PUBLIC_ prefix for Expo environment variables
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

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

export default api;
