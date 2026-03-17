import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../axios';
import i18n from '../i18n';

interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active_household: string | null;
  locale?: string;
}

const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es'];

function applyLocale(locale?: string) {
  if (!locale || !SUPPORTED_LANGUAGES.includes(locale)) return;
  localStorage.setItem('lang', locale);
  if (i18n.language !== locale) i18n.changeLanguage(locale);
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
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
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('lang');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
