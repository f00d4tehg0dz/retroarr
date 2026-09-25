import axios from 'axios';

// Axios instance targeting the Express backend.
// In dev: Vite proxy forwards /api/* to localhost:8888
// In production: same origin (React is served by Express)
const retroApi = axios.create({
  baseURL: '/api',
  timeout: 10_000,
});

// Admin key (only needed when the server sets ADMIN_TOKEN). Stored per
// browser; sent on every API call so settings/plugins/channel edits work.
export const ADMIN_KEY_STORAGE = 'retroarr.adminKey';
export function getAdminKey() {
  try { return localStorage.getItem(ADMIN_KEY_STORAGE) || ''; } catch { return ''; }
}
export function setAdminKey(key) {
  try { key ? localStorage.setItem(ADMIN_KEY_STORAGE, key) : localStorage.removeItem(ADMIN_KEY_STORAGE); } catch { /* private mode */ }
}

retroApi.interceptors.request.use((cfg) => {
  const key = getAdminKey();
  if (key) cfg.headers['X-Admin-Key'] = key;
  return cfg;
});

// Turn the server's admin refusals into readable errors
retroApi.interceptors.response.use(
  (r) => r,
  (err) => {
    const data = err.response?.data;
    if (data?.code === 'ADMIN_KEY') err.message = 'Admin key required — add it under Settings → Access.';
    else if (data?.code === 'NOT_LOCAL' || data?.code === 'PROXY_UNTRUSTED') err.message = data.error;
    return Promise.reject(err);
  }
);

export default retroApi;
