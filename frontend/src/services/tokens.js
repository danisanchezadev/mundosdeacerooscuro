const ACCESS_KEY = 'mao.access';
const REFRESH_KEY = 'mao.refresh';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  hasSession: () => Boolean(localStorage.getItem(ACCESS_KEY) || localStorage.getItem(REFRESH_KEY)),
};

export const AUTH_LOGOUT_EVENT = 'mao:auth-logout';
