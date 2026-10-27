import axios from 'axios';
import { AUTH_LOGOUT_EVENT, tokenStorage } from './tokens';

export const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

const NO_REFRESH_PREFIXES = ['/auth/login/', '/auth/token/', '/auth/registration/', '/auth/google/', '/auth/password/'];

let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) throw new Error('No refresh token');
  // Plain axios: this call must not go through the interceptors below.
  const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh });
  tokenStorage.set({ access: data.access, refresh: data.refresh ?? refresh });
  return data.access;
}

api.interceptors.request.use((config) => {
  const access = tokenStorage.getAccess();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const skip = !config || NO_REFRESH_PREFIXES.some((prefix) => config.url?.startsWith(prefix));

    if (response?.status !== 401 || config?._retried || skip || !tokenStorage.getRefresh()) {
      return Promise.reject(error);
    }

    config._retried = true;
    try {
      // Concurrent 401s share one refresh request (the refresh token rotates).
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const access = await refreshPromise;
      config.headers.Authorization = `Bearer ${access}`;
      return api(config);
    } catch (refreshError) {
      tokenStorage.clear();
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
      return Promise.reject(refreshError);
    }
  },
);

/** Normalises DRF / dj-rest-auth error payloads into { message, fields }. */
export function parseApiError(error) {
  const fallback = 'Error de comunicación con el servidor.';
  const data = error?.response?.data;
  if (!error?.response) return { message: fallback, fields: {} };
  if (error.response.status === 429) {
    return { message: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.', fields: {} };
  }
  if (typeof data === 'string') return { message: fallback, fields: {} };
  if (!data || typeof data !== 'object') return { message: fallback, fields: {} };

  const flatten = (value) => (Array.isArray(value) ? value.map(flatten).join(' ') : String(value));
  const fields = {};
  const general = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'detail' || key === 'non_field_errors') general.push(flatten(value));
    else fields[key] = flatten(value);
  }
  const message = general.join(' ') || Object.values(fields)[0] || fallback;
  return { message, fields };
}
