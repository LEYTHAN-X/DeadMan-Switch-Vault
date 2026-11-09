import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach Authorization Bearer token if present in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Catch 401s and handle session expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthCall) {
        localStorage.removeItem('dms_token');
        localStorage.removeItem('dms_user');
      }
    }
    return Promise.reject(error);
  }
);

// API Service Methods
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  checkIn: () => api.post('/auth/checkin'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (token, data) => api.post(`/auth/reset-password/${token}`, data),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const evidenceApi = {
  list: () => api.get('/evidence'),
  get: (id) => api.get(`/evidence/${id}`),
  upload: (formData, onProgress) =>
    api.post('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }),
  download: (id) =>
    api.get(`/evidence/${id}/download`, {
      responseType: 'blob',
    }),
  delete: (id) => api.delete(`/evidence/${id}`),
};

export const contactsApi = {
  list: () => api.get('/contacts'),
  get: (id) => api.get(`/contacts/${id}`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
  verify: (token) => api.get(`/contacts/verify/${token}`),
  assignEvidence: (id, evidenceIds) => api.post(`/contacts/${id}/assign-evidence`, { evidenceIds }),
  resendVerification: (id) => api.post(`/contacts/${id}/resend-verification`),
};

export const gmailApi = {
  getStatus: () => api.get('/gmail/status'),
  connect: () => api.post('/gmail/connect'),
  sendTest: (data) => api.post('/gmail/send-test', data),
  disconnect: () => api.delete('/gmail/disconnect'),
};

export const checkinApi = {
  getConfig: () => api.get('/checkin/config'),
  updateConfig: (data) => api.put('/checkin/config', data),
  checkInNow: () => api.post('/checkin/now'),
};

export const emergencyApi = {
  getStatus: () => api.get('/emergency/status'),
  cancel: (reason) => api.post('/emergency/cancel', { reason }),
  verify: (code) => api.post('/emergency/verify', { code }),
  approve: (isApproved) => api.post('/emergency/approve', { isApproved }),
  executeRelease: () => api.post('/emergency/execute-release'),
  simulateEscalate: () => api.post('/emergency/simulate-escalation'),
};

export const auditApi = {
  list: (params) => api.get('/audit', { params }),
  getStats: () => api.get('/audit/stats'),
  downloadExport: (format = 'json') =>
    api.get(`/audit/export?format=${format}`, {
      responseType: 'blob',
    }),
};

export const checkSystemHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    if (error.response?.data) {
      return error.response.data;
    }
    return {
      status: 'offline',
      service: 'Dead Man Switch API',
      message: error.message || 'Cannot reach backend server',
      dependencies: {
        database: { isConnected: false, state: 'disconnected' },
      },
    };
  }
};

export default api;
