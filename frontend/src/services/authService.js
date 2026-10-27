import { api } from './api';
import { tokenStorage } from './tokens';

export const authService = {
  async login({ email, password }) {
    const { data } = await api.post('/auth/login/', { email, password });
    tokenStorage.set(data);
    return data;
  },

  async register({ name, email, password1, password2 }) {
    const { data } = await api.post('/auth/registration/', { name, email, password1, password2 });
    if (data?.access) tokenStorage.set(data);
    return data;
  },

  async googleLogin(code) {
    const { data } = await api.post('/auth/google/', { code });
    tokenStorage.set(data);
    return data;
  },

  async logout() {
    const refresh = tokenStorage.getRefresh();
    try {
      if (refresh) await api.post('/auth/logout/', { refresh });
    } finally {
      tokenStorage.clear();
    }
  },

  async me() {
    const { data } = await api.get('/users/me/');
    return data;
  },

  async updateMe(payload) {
    const { data } = await api.patch('/users/me/', payload);
    return data;
  },

  async requestPasswordReset(email) {
    const { data } = await api.post('/auth/password/reset/', { email });
    return data;
  },

  async confirmPasswordReset({ uid, token, new_password1, new_password2 }) {
    const { data } = await api.post('/auth/password/reset/confirm/', { uid, token, new_password1, new_password2 });
    return data;
  },

  async changePassword({ old_password, new_password1, new_password2 }) {
    const { data } = await api.post('/auth/password/change/', { old_password, new_password1, new_password2 });
    return data;
  },
};
