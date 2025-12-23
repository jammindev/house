// Admin access protection component
"use client";

import { useEffect, useState } from 'react';
import { useAdminContext } from '../hooks/useAdmin';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    clearImpersonationState,
    IMPERSONATION_EVENT,
    readImpersonationOrigin,
    readImpersonationTarget,
    type StoredImpersonationOrigin,
    type StoredImpersonationTarget,
} from '../lib/impersonationStorage';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';

interface AdminGuardProps {
    children: React.ReactNode;
    requireSuperAdmin?: boolean;
    fallback?: React.ReactNode;
}

export function AdminGuard({ children, requireSuperAdmin = false, fallback }: AdminGuardProps) {
    const { isAdmin, isSuperAdmin, loading, adminRole, refresh } = useAdminContext();
    const [impersonationOrigin, setImpersonationOrigin] = useState<StoredImpersonationOrigin | null>(null);
    const [impersonationTarget, setImpersonationTarget] = useState<StoredImpersonationTarget | null>(null);
    const [restoringAdmin, setRestoringAdmin] = useState(false);

    useEffect(() => {
        const sync = () => {
            setImpersonationOrigin(readImpersonationOrigin());
            setImpersonationTarget(readImpersonationTarget());
        };
        sync();
        window.addEventListener(IMPERSONATION_EVENT, sync);
        return () => window.removeEventListener(IMPERSONATION_EVENT, sync);
    }, []);

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
        if (impersonationOrigin) {
            const restoreAdmin = async () => {
                try {
                    setRestoringAdmin(true);
                    const supa = await createSPASassClientAuthenticated();
                    const client = supa.getSupabaseClient();

                    const { error } = await client.auth.setSession({
                        access_token: impersonationOrigin.access_token,
                        refresh_token: impersonationOrigin.refresh_token,
                    });

                    if (error) {
                        throw error;
                    }

                    clearImpersonationState();
                    setImpersonationOrigin(null);
                    setImpersonationTarget(null);
                    await refresh();
                } catch (error) {
                    console.error("Failed to restore admin session", error);
                } finally {
                    setRestoringAdmin(false);
                }
            };

            return (
                <div className="flex items-center justify-center min-h-[400px] p-6">
                    <Alert className="max-w-md">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertDescription className="space-y-3">
                            <p className="font-medium">Mode impersonation actif</p>
                            <p className="text-sm text-muted-foreground">
                                Vous êtes connecté en tant que {impersonationTarget?.email || "un autre compte"}. Reprenez votre session
                                administrateur pour continuer.
                            </p>
                            <Button onClick={restoreAdmin} disabled={restoringAdmin} className="w-full gap-2">
                                {restoringAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                                Revenir sur mon compte admin
                            </Button>
                        </AlertDescription>
                    </Alert>
                </div>
            );
        }

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
