import { Suspense, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';
import { useMe } from '../features/settings/hooks';
import { applyDarkMode, applyColorTheme } from '../lib/theme';
import AppShell from './AppShell';
import ErrorBoundary from './ErrorBoundary';

export default function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  const { data: profile } = useMe();

  useEffect(() => {
    if (profile) {
      applyDarkMode(profile.theme ?? 'system');
      applyColorTheme(profile.color_theme ?? 'theme-house');
    }
  }, [profile?.theme, profile?.color_theme]);

  if (!isLoading && !user) return <Navigate to="/login" replace />;

  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={null}>
          {isLoading ? null : <Outlet />}
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
