// Hook for admin permissions and context
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { AdminRole, AdminContext, SystemStats } from '../types';

export function useAdminContext(): AdminContext {
    const [adminRole, setAdminRole] = useState<AdminRole>('user');
    const [loading, setLoading] = useState(true);

    const checkAdminStatus = useCallback(async () => {
        try {
            setLoading(true);

            const supabase = await createSPASassClientAuthenticated();
            const client = supabase.getSupabaseClient();
            
            const { data: user } = await client.auth.getUser();
            if (!user?.user?.id) {
                setAdminRole('user');
                return;
            }

            // Vérifier si l'utilisateur est admin via une requête SQL personnalisée
            // Utilisons une approche de fallback sécurisée
            try {
                // Tentative d'utilisation de la fonction RPC (quand les types seront mis à jour)
                const result = await (client as any).rpc('get_user_admin_role');
                if (result.error) {
                    console.warn('RPC function not available, user has no admin privileges');
                    setAdminRole('user');
                } else {
                    setAdminRole((result.data as AdminRole) || 'user');
                }
            } catch (rpcError) {
                // Fallback: supposer que l'utilisateur n'est pas admin
                console.warn('Admin functions not available, defaulting to user role');
                setAdminRole('user');
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            setAdminRole('user');
        } finally {
            setLoading(false);
        }
    }, []);

    const refresh = useCallback(async () => {
        await checkAdminStatus();
    }, [checkAdminStatus]);

    useEffect(() => {
        checkAdminStatus();
    }, [checkAdminStatus]);

    return {
        isAdmin: adminRole === 'admin' || adminRole === 'super_admin',
        isSuperAdmin: adminRole === 'super_admin',
        adminRole,
        loading,
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