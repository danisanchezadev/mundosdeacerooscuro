import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { AUTH_LOGOUT_EVENT, tokenStorage } from '../../services/tokens';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => tokenStorage.hasSession());

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    if (!tokenStorage.hasSession()) return undefined;
    let active = true;
    authService
      .me()
      .then((me) => active && setUser(me))
      .catch(() => active && clearSession())
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    window.addEventListener(AUTH_LOGOUT_EVENT, clearSession);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, clearSession);
  }, [clearSession]);

  const loadUser = useCallback(async () => {
    const me = await authService.me();
    setUser(me);
    queryClient.invalidateQueries();
    return me;
  }, [queryClient]);

  const login = useCallback(
    async (credentials) => {
      await authService.login(credentials);
      return loadUser();
    },
    [loadUser],
  );

  const register = useCallback(
    async (payload) => {
      const data = await authService.register(payload);
      if (data?.access) {
        await loadUser();
        return { authenticated: true };
      }
      return { authenticated: false, detail: data?.detail };
    },
    [loadUser],
  );

  const googleLogin = useCallback(
    async (code) => {
      await authService.googleLogin(code);
      return loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // The local session is dropped even if the server-side blacklist call fails.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      login,
      register,
      googleLogin,
      logout,
      setUser,
    }),
    [user, loading, login, register, googleLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
