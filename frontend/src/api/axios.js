import axios from 'axios';
import { getToken, clearToken, currentPortal } from '../portal';

// A configured "localhost" API only works on this computer. When the site is
// opened by another address (127.0.0.1, or a phone on the same Wi-Fi), call the
// API on that same host instead.
const resolveApiUrl = () => {
  const configured = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const pageHost = window.location.hostname;
  try {
    const url = new URL(configured);
    if (['localhost', '127.0.0.1'].includes(url.hostname) && pageHost && pageHost !== url.hostname) {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, '');
    }
  } catch { /* not an absolute URL — use as-is */ }
  return configured;
};

export const API_BASE_URL = resolveApiUrl();
// Root URL (no /api), for building links to uploaded files like photos.
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  // Each portal has its own sign-in (see src/portal.js).
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A failed sign-in attempt is shown on the login form, not redirected.
    const isLogin = /\/auth\/(login|register)$/.test(error.config?.url || '');
    if (error.response?.status === 401 && !isLogin) {
      clearToken();
      const portal = currentPortal();
      window.location.href = portal ? `/${portal}/login` : '/';
    }
    return Promise.reject(error);
  }
);

export default api;
