// Admin access protection component
"use client";

import { useAdminContext } from '../hooks/useAdmin';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, ShieldAlert } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  fallback?: React.ReactNode;
}

export function AdminGuard({ children, requireSuperAdmin = false, fallback }: AdminGuardProps) {
  const { isAdmin, isSuperAdmin, loading, adminRole } = useAdminContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Vérification des permissions...</span>
        </div>
      </div>
    );
  }

  const hasRequiredPermission = requireSuperAdmin ? isSuperAdmin : isAdmin;

  if (!hasRequiredPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Alert className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-medium">Accès refusé</p>
            <p className="text-sm">
              {requireSuperAdmin 
                ? "Cette section nécessite des privilèges de super administrateur."
                : "Cette section nécessite des privilèges d'administrateur."
              }
            </p>
            <p className="text-xs text-muted-foreground">
              Votre rôle actuel: {adminRole === 'user' ? 'Utilisateur' : 
                adminRole === 'admin' ? 'Administrateur' : 'Super Administrateur'}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="admin-content">
      {children}
    </div>
  );
}

interface AdminBadgeProps {
  role: string;
}

export function AdminBadge({ role }: AdminBadgeProps) {
  if (role === 'user') return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
      <Shield className="h-3 w-3" />
      {role === 'super_admin' ? 'Super Admin' : 'Admin'}
    </div>
  );
}