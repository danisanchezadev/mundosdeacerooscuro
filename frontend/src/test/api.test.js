import { beforeEach, describe, expect, it } from 'vitest';
import { api, parseApiError } from '../services/api';
import { AUTH_LOGOUT_EVENT, tokenStorage } from '../services/tokens';
import { cleanParams } from '../services/resources';

const ok = (config, data, status = 200) => Promise.resolve({ data, status, statusText: '', headers: {}, config });
const fail = (config, status, data = {}) => {
  const error = new Error(`status ${status}`);
  error.isAxiosError = true;
  error.config = config;
  error.response = { status, data, headers: {}, config };
  return Promise.reject(error);
};

describe('parseApiError', () => {
  const make = (status, data) => ({ response: { status, data } });

  it('flattens DRF field errors', () => {
    const parsed = parseApiError(make(400, { email: ['Inválido.'], non_field_errors: ['Fallo general.'] }));
    expect(parsed.fields.email).toBe('Inválido.');
    expect(parsed.message).toBe('Fallo general.');
  });

  it('uses detail for permission errors', () => {
    expect(parseApiError(make(403, { detail: 'Prohibido' })).message).toBe('Prohibido');
  });

  it('handles throttling and network errors', () => {
    expect(parseApiError(make(429, { detail: 'x' })).message).toMatch(/Demasiadas peticiones/);
    expect(parseApiError(new Error('Network Error')).message).toMatch(/comunicación/);
    expect(parseApiError(make(500, '<html>')).message).toMatch(/comunicación/);
  });
});

describe('cleanParams', () => {
  it('drops empty values', () => {
    expect(cleanParams({ a: '', b: null, c: undefined, d: false, e: 0, f: 'x', g: true })).toEqual({ e: 0, f: 'x', g: true });
  });
});

describe('axios auth interceptors', () => {
  beforeEach(() => {
    tokenStorage.clear();
    api.defaults.adapter = undefined;
  });

  it('sends the bearer token', async () => {
    tokenStorage.set({ access: 'abc', refresh: 'r' });
    let seen;
    api.defaults.adapter = (config) => {
      seen = config.headers.Authorization;
      return ok(config, {});
    };
    await api.get('/books/');
    expect(seen).toBe('Bearer abc');
  });

  it('refreshes the token once on 401 and retries', async () => {
    tokenStorage.set({ access: 'old', refresh: 'refresh-1' });
    const calls = [];
    api.defaults.adapter = (config) => {
      calls.push(config.headers.Authorization);
      return calls.length === 1 ? fail(config, 401) : ok(config, { fine: true });
    };
    const axios = (await import('axios')).default;
    const original = axios.post;
    axios.post = () => Promise.resolve({ data: { access: 'new', refresh: 'refresh-2' } });

    try {
      const response = await api.get('/loans/');
      expect(response.data).toEqual({ fine: true });
      expect(calls).toEqual(['Bearer old', 'Bearer new']);
      expect(tokenStorage.getAccess()).toBe('new');
      expect(tokenStorage.getRefresh()).toBe('refresh-2');
    } finally {
      axios.post = original;
    }
  });

  it('clears the session and notifies when refresh fails', async () => {
    tokenStorage.set({ access: 'old', refresh: 'bad' });
    api.defaults.adapter = (config) => fail(config, 401);
    const axios = (await import('axios')).default;
    const original = axios.post;
    axios.post = () => Promise.reject(new Error('refresh denied'));
    let notified = false;
    const listener = () => {
      notified = true;
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, listener);

    try {
      await expect(api.get('/loans/')).rejects.toBeTruthy();
      expect(notified).toBe(true);
      expect(tokenStorage.hasSession()).toBe(false);
    } finally {
      axios.post = original;
      window.removeEventListener(AUTH_LOGOUT_EVENT, listener);
    }
  });

  it('does not try to refresh on login failures', async () => {
    tokenStorage.set({ access: 'old', refresh: 'r' });
    let attempts = 0;
    api.defaults.adapter = (config) => {
      attempts += 1;
      return fail(config, 401, { detail: 'bad credentials' });
    };
    await expect(api.post('/auth/login/', {})).rejects.toBeTruthy();
    expect(attempts).toBe(1);
  });
});
