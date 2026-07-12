import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useDisabledModules } from '@/lib/modules';

/**
 * Guard des routes de modules optionnels (parcours 15) : si le module est
 * désactivé pour le foyer, redirige vers le dashboard. Rend null pendant le
 * chargement du household pour éviter un flash de redirect à tort.
 */
export default function ModuleRoute({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const { disabled, isLoading } = useDisabledModules();
  if (isLoading) return null;
  if (disabled.has(moduleKey)) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}
