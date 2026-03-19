import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../axios';
import { queryClient } from '../queryClient';
import i18n from '../i18n';

interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active_household: string | null;
  locale?: string;
  is_staff?: boolean;
}

const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es'];

function applyLocale(locale?: string) {
  if (!locale || !SUPPORTED_LANGUAGES.includes(locale)) return;
  localStorage.setItem('lang', locale);
  if (i18n.language !== locale) i18n.changeLanguage(locale);
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  async function reloadUser() {
    const me = await api.get<AuthUser>('/accounts/me/');
    setUser(me.data);
    applyLocale(me.data.locale);
    const token = localStorage.getItem('access_token');
    const payload = token ? parseJwtPayload(token) : null;
    setIsImpersonating(!!payload?.impersonated_by);
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    const payload = parseJwtPayload(token);
    setIsImpersonating(!!payload?.impersonated_by);
    api.get<AuthUser>('/accounts/me/')
      .then((res) => { setUser(res.data); applyLocale(res.data.locale); })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post<{ access: string; refresh: string }>('/auth/token/', { email, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const me = await api.get<AuthUser>('/accounts/me/');
    setUser(me.data);
    applyLocale(me.data.locale);
    setIsImpersonating(false);
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('_impersonator_tokens');
    localStorage.removeItem('lang');
    setUser(null);
    setIsImpersonating(false);
  }

  async function impersonate(userId: string) {
    // Save current admin tokens
    localStorage.setItem('_impersonator_tokens', JSON.stringify({
      access: localStorage.getItem('access_token'),
      refresh: localStorage.getItem('refresh_token'),
      adminEmail: user?.email,
    }));
    const { data } = await api.post<{ access: string }>(`/accounts/users/${userId}/impersonate/`);
    localStorage.setItem('access_token', data.access);
    localStorage.removeItem('refresh_token');
    queryClient.clear();
    await reloadUser();
  }

  async function stopImpersonation() {
    const saved = JSON.parse(localStorage.getItem('_impersonator_tokens') ?? '{}');
    if (saved.access) {
      localStorage.setItem('access_token', saved.access);
      if (saved.refresh) {
        localStorage.setItem('refresh_token', saved.refresh);
      } else {
        localStorage.removeItem('refresh_token');
      }
    }
    localStorage.removeItem('_impersonator_tokens');
    queryClient.clear();
    await reloadUser();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isImpersonating, login, logout, impersonate, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
