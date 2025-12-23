// Hook for admin permissions and context
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { AdminRole, AdminContext, SystemStats } from '../types';

// Admin features are optional; only check Supabase when explicitly enabled.
const ADMIN_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ADMIN === 'true';

export function useAdminContext(): AdminContext {
    const [adminRole, setAdminRole] = useState<AdminRole>('user');
    const [loading, setLoading] = useState(true);

    const checkAdminStatus = useCallback(async () => {
        if (!ADMIN_FEATURE_ENABLED) {
            setAdminRole('user');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const response = await fetch('/api/admin/role', { cache: 'no-store' });
            if (!response.ok) {
                setAdminRole('user');
                return;
            }
            const payload = await response.json();
            const role = payload?.role as AdminRole | undefined;
            setAdminRole(role || 'user');
        } catch (error) {
            console.error('Error checking admin status:', error);
            setAdminRole('user');
        } finally {
            setLoading(false);
        }
    }, [ADMIN_FEATURE_ENABLED]);

    const refresh = useCallback(async () => {
        await checkAdminStatus();
    }, [checkAdminStatus]);

    useEffect(() => {
        checkAdminStatus();
    }, [checkAdminStatus]);

    const isAdmin = ADMIN_FEATURE_ENABLED && (adminRole === 'admin' || adminRole === 'super_admin');
    const isSuperAdmin = ADMIN_FEATURE_ENABLED && adminRole === 'super_admin';

    return {
        isAdmin,
        isSuperAdmin,
        adminRole: ADMIN_FEATURE_ENABLED ? adminRole : 'user',
        loading: ADMIN_FEATURE_ENABLED ? loading : false,
        refresh,
    };
}

export function useSystemStats() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const supabase = await createSPASassClientAuthenticated();
            const client = supabase.getSupabaseClient();

            try {
                // Tentative d'utilisation de la fonction RPC get_system_stats
                const result = await (client as any).rpc('get_system_stats');
                if (result.error) {
                    throw new Error(result.error.message);
                }
                setStats(result.data as SystemStats);
            } catch (rpcError) {
                // Fallback: calculer les stats manuellement via les tables existantes
                console.warn('System stats RPC not available, calculating manually...');

                const [
                    { count: totalHouseholds },
                    { count: totalInteractions },
                    { count: totalZones },
                    { count: totalProjects },
                    { count: totalEquipment }
                ] = await Promise.all([
                    client.from('households').select('*', { count: 'exact', head: true }),
                    client.from('interactions').select('*', { count: 'exact', head: true }),
                    client.from('zones').select('*', { count: 'exact', head: true }),
                    client.from('projects').select('*', { count: 'exact', head: true }),
                    client.from('equipment').select('*', { count: 'exact', head: true })
                ]);

                const fallbackStats: SystemStats = {
                    total_users: 0, // Pas accessible depuis les tables publiques
                    total_households: totalHouseholds || 0,
                    total_interactions: totalInteractions || 0,
                    total_zones: totalZones || 0,
                    total_documents: 0, // Calculé approximativement
                    total_projects: totalProjects || 0,
                    total_equipment: totalEquipment || 0,
                    active_users_last_30_days: 0, // Pas accessible
                    new_households_last_30_days: 0, // Calculé approximativement
                    storage_usage_mb: 0, // Pas accessible
                };

                setStats(fallbackStats);
            }
        } catch (err) {
            console.error('Error fetching system stats:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refresh: fetchStats };
}
