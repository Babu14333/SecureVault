import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let detectedLanIp = '10.57.151.58';

// ─── Dynamic Network Host Resolution ─────────────────────────────────────────
export const getNetworkHost = (): string => {
  // 1. Web browser environment — dynamically resolve browser hostname (LAN IP, domain, etc.)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  // 2. Mobile device / Expo Go — extract host IP dynamically from Expo dev server
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  // 3. Default fallback
  return detectedLanIp || '10.57.151.58';
};

export const getShareHost = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const h = window.location.hostname;
    if (h !== 'localhost' && h !== '127.0.0.1') {
      return h;
    }
  }
  return detectedLanIp || '10.57.151.58';
};

// ─── Web-safe SecureStore wrapper ──────────────────────────────────────────────
export const webSafeSecureStore = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`Failed to get ${key}:`, error);
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {}
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`Failed to set ${key}:`, error);
      try {
        await AsyncStorage.setItem(key, value);
      } catch {}
    }
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        await AsyncStorage.removeItem(key);
      } catch {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`Failed to delete ${key}:`, error);
      try {
        await AsyncStorage.removeItem(key);
      } catch {}
    }
  },
};

// ─── Server URL Storage Key ────────────────────────────────────────────────────
export const SERVER_URL_KEY = 'server_url';
export const DEFAULT_PORT = '5000';

// ─── Get/Set Server URL ────────────────────────────────────────────────────────
export const getServerUrl = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(SERVER_URL_KEY);
};

export const setServerUrl = async (url: string): Promise<void> => {
  // Normalize: strip trailing slash, ensure no /api suffix
  const clean = url.replace(/\/+$/, '').replace(/\/api$/, '');
  await AsyncStorage.setItem(SERVER_URL_KEY, clean);
  // Update axios base URL immediately
  api.defaults.baseURL = `${clean}/api`;
};

export const clearServerUrl = async (): Promise<void> => {
  await AsyncStorage.removeItem(SERVER_URL_KEY);
};

export const testServerUrl = async (url: string): Promise<boolean> => {
  const clean = url.replace(/\/+$/, '').replace(/\/api$/, '');
  try {
    const res = await axios.get(`${clean}/api/health`, { timeout: 5000 });
    return res.data?.success === true;
  } catch {
    return false;
  }
};

export const testServerUrls = async (urls: string[]): Promise<string | null> => {
  for (const url of urls) {
    const clean = url.replace(/\/+$/, '').replace(/\/api$/, '');
    try {
      const res = await axios.get(`${clean}/api/health`, { timeout: 5000 });
      if (res.data?.success === true) {
        return clean;
      }
    } catch {
      // Try the next candidate URL
    }
  }

  return null;
};

// ─── Axios Instance (baseURL set dynamically on app start) ────────────────────
const api = axios.create({
  baseURL: `http://localhost:${DEFAULT_PORT}/api`, // Default to backend port 5000
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Initialize API with default/stored server URL ────────────────────────────
export const initializeApi = async (): Promise<boolean> => {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (stored) {
      const clean = stored.replace(/\/+$/, '').replace(/\/api$/, '');
      try {
        await axios.get(`${clean}/api/health`, { timeout: 2500 });
        api.defaults.baseURL = `${clean}/api`;
        return true;
      } catch {
        // Stale or unreachable IP stored — clear it so dynamic network resolution takes over
        await AsyncStorage.removeItem(SERVER_URL_KEY);
      }
    }

    const networkHost = getNetworkHost();
    const candidateUrls = Array.from(new Set([
      `http://${networkHost}:${DEFAULT_PORT}`,
      `http://127.0.0.1:${DEFAULT_PORT}`,
      `http://localhost:${DEFAULT_PORT}`,
    ]));

    const workingUrl = await testServerUrls(candidateUrls);
    if (workingUrl) {
      api.defaults.baseURL = `${workingUrl}/api`;
    } else {
      api.defaults.baseURL = `http://${networkHost}:${DEFAULT_PORT}/api`;
    }
  } catch (err) {
    api.defaults.baseURL = `http://127.0.0.1:${DEFAULT_PORT}/api`;
  }
  return true;
};

// ─── Request interceptor: attach auth token ───────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await webSafeSecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor: token refresh on 401 ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if originalRequest exists before accessing its properties
    if (!originalRequest) {
      return Promise.reject(error);
    }
    
    const isPublicOrAuth = originalRequest.url && (
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/register') ||
      originalRequest.url.includes('/auth/verify-otp') ||
      originalRequest.url.includes('/auth/verify-login-otp') ||
      originalRequest.url.includes('/share/verify') ||
      originalRequest.url.includes('/forgot-password')
    );

    if (error.response?.status === 401 && !originalRequest._retry && !isPublicOrAuth) {
      originalRequest._retry = true;
      try {
        const refreshToken = await webSafeSecureStore.getItemAsync('refreshToken');
        if (refreshToken) {
          const baseURL = api.defaults.baseURL;
          const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          if (data.success) {
            await webSafeSecureStore.setItemAsync('accessToken', data.data.accessToken);
            await webSafeSecureStore.setItemAsync('refreshToken', data.data.refreshToken);
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        await webSafeSecureStore.deleteItemAsync('accessToken');
        await webSafeSecureStore.deleteItemAsync('refreshToken');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { email: string; password: string; fullName: string; phone?: string; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  verifyOTP: (data: { userId: string; otp: string; type: string }) =>
    api.post('/auth/verify-otp', data),
  verifyLoginOTP: (data: {
    userId: string;
    otpCode: string;
    deviceId?: string;
    trustDevice?: boolean;
  }) => api.post('/auth/verify-login-otp', data),
  resendOTP: (data: { userId: string; type?: string }) =>
    api.post('/auth/resend-otp', data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  logout: (sessionId: string) =>
    api.post('/auth/logout', { sessionId }),
  getProfile: () => api.get('/auth/profile'),
  requestPasswordOTP: () =>
    api.post('/auth/request-password-otp'),
  changePassword: (data: { oldPassword?: string; otpCode?: string; newPassword: string }) =>
    api.put('/auth/change-password', data),
  deleteAccount: () =>
    api.post('/auth/delete-account'),
  toggleTwoFactor: (enabled: boolean) =>
    api.post('/auth/two-factor', { enabled }),
  checkAdmin: () =>
    api.get('/auth/check-admin'),
  forgotPasswordRequest: (payload: { email?: string; phone?: string } | string) => {
    const body = typeof payload === 'string'
      ? (payload.includes('@') ? { email: payload } : { phone: payload })
      : payload;
    return api.post('/auth/forgot-password/request', body);
  },
  forgotPasswordVerify: (userId: string, otpCode: string) =>
    api.post('/auth/forgot-password/verify', { userId, otpCode }),
  forgotPasswordReset: (userId: string, resetToken: string, newPassword: string) =>
    api.post('/auth/forgot-password/reset', { userId, resetToken, newPassword }),
};

// ─── Files API ─────────────────────────────────────────────────────────────────
export const filesAPI = {
  upload: (formData: FormData) =>
    api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getFiles: (params?: Record<string, any>) =>
    api.get('/files', { params }),
  getFile: (id: string) => api.get(`/files/${id}`),
  deleteFile: (id: string) => api.delete(`/files/${id}`),
  getStats: () => api.get('/files/stats'),
  getDownloadToken: (id: string) => api.post(`/files/${id}/download-token`),
};

// ─── Sharing API ───────────────────────────────────────────────────────────────
export const sharingAPI = {
  createLink: (data: {
    fileId: string;
    expiresIn?: number;
    maxDownloads?: number;
    password?: string;
    requireOtp?: boolean;
  }) => api.post('/share/create', data),
  requestShareOTP: (token: string) =>
    api.post(`/share/request-otp/${token}`, {}),
  verifyLink: (token: string, data?: { password?: string; otp?: string }) =>
    api.post(`/share/verify/${token}`, data),
  resendShareOTP: (token: string, phone: string) =>
    api.post('/otp/resend', { type: 'share_access', targetPhone: phone }),
  getLinks: () => api.get('/share'),
  toggleLink: (id: string, isActive: boolean) => api.put(`/share/${id}/toggle`, { isActive }),
};

// ─── Security API ──────────────────────────────────────────────────────────────
export const securityAPI = {
  getLogs: (params?: Record<string, any>) =>
    api.get('/security/logs', { params }),
  getAlerts: () => api.get('/security/alerts'),
  getSessions: () => api.get('/security/sessions'),
  terminateSession: (sessionId: string) =>
    api.delete(`/security/sessions/${sessionId}`),
};

// ─── Admin API ─────────────────────────────────────────────────────────────────
export const adminAPI = {
  // SOC Telemetry & Overview
  getOverview: () => api.get('/admin/overview'),
  getAnalytics: () => api.get('/admin/overview'),
  getLiveStream: (params?: Record<string, any>) => api.get('/admin/live-stream', { params }),

  // User Risk Governance & Sessions
  getUsers: (params?: Record<string, any>) => api.get('/admin/users', { params }),
  getUsersMonitoring: (params?: Record<string, any>) => api.get('/admin/users/monitoring', { params }),
  getUserSessions: (userId: string) => api.get(`/admin/users/${userId}/sessions`),
  revokeUserSessions: (userId: string) => api.post(`/admin/users/${userId}/revoke-sessions`),
  updateRole: (userId: string, role: string) => api.put(`/admin/users/${userId}/role`, { role }),
  suspendUser: (userId: string, suspend: boolean) => api.post(`/admin/users/${userId}/suspend`, { suspend }),
  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),

  // File Integrity & Access Monitoring
  getFilesMonitoring: (params?: Record<string, any>) => api.get('/admin/files/monitoring', { params }),
  revokeFileSharing: (fileId: string) => api.post(`/admin/files/${fileId}/revoke-sharing`),

  // Threat Center & Incident Investigation
  getAlerts: (params?: Record<string, any>) => api.get('/admin/security-alerts', { params }),
  updateAlertStatus: (alertId: string, data: any) => api.put(`/admin/security-alerts/${alertId}/status`, data),
  getIncident: (alertId: string) => api.get(`/admin/incidents/${alertId}`),
  remediateIncident: (alertId: string, data: any) => api.post(`/admin/incidents/${alertId}/remediate`, data),

  // Secure Sharing Governance
  getSharingManagement: () => api.get('/admin/sharing'),
  revokeSharedLink: (linkId: string) => api.post(`/admin/sharing/${linkId}/revoke`),

  // Searchable SIEM Access Logs
  getAccessLogs: (params?: Record<string, any>) => api.get('/admin/access-logs', { params }),

  // Security Policies & Rules Engine
  getPolicies: () => api.get('/admin/policies'),
  updatePolicies: (data: any) => api.put('/admin/policies', data),
};

// ─── OTP API ───────────────────────────────────────────────────────────────────
export const otpAPI = {
  send: (data: { userId?: string; type: string; targetPhone: string; refId?: string }) =>
    api.post('/otp/send', data),
  verify: (data: { userId?: string; otpCode: string; type: string; refId?: string }) =>
    api.post('/otp/verify', data),
  resend: (data: { userId?: string; type: string; targetPhone: string; refId?: string }) =>
    api.post('/otp/resend', data),
};

// ─── Devices API ───────────────────────────────────────────────────────────────
export const devicesAPI = {
  getDevices: () => api.get('/devices'),
  removeDevice: (id: string) => api.delete(`/devices/${id}`),
  trustDevice: (id: string) => api.put(`/devices/${id}/trust`),
};
