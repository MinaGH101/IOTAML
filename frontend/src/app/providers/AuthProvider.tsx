import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserProfile } from '../../shared/_types';
import { authApi } from '../../auth/_service/authApi';
import { clearAuthToken, onUnauthorized } from '../../shared/api/httpClient';
import { clearServerQueryCache } from '../../shared/state/serverQuery';

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  setUser(user: UserProfile | null): void;
  logout(): void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const clearSession = useCallback(() => {
    clearAuthToken();
    clearServerQueryCache();
    setUser(null);
  }, []);
  const logout = useCallback(() => {
    void authApi.logout().catch(() => undefined).finally(clearSession);
  }, [clearSession]);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);
  useEffect(() => {
    const controller = new AbortController();
    authApi.me(controller.signal)
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [logout]);

  const value = useMemo(() => ({ user, loading, setUser, logout }), [loading, logout, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
