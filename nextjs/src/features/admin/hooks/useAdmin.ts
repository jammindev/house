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
      
      // TODO: Implement when migration is applied
      // const supabase = await createSPASassClientAuthenticated();
      // const client = supabase.getSupabaseClient();
      // const { data: role, error } = await client.rpc('get_user_admin_role');
      // if (error) {
      //   console.error('Error checking admin status:', error);
      //   setAdminRole('user');
      // } else {
      //   setAdminRole(role || 'user');
      // }

      // TEMPORAIRE: Simuler un super admin pour tester l'interface
      // Changez 'user' en 'super_admin' pour tester l'interface admin
      setAdminRole('super_admin');
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

      // Pour l'instant, on simule les stats jusqu'à ce que la migration soit appliquée
      const mockStats: SystemStats = {
        total_users: 0,
        total_households: 0,
        total_interactions: 0,
        total_zones: 0,
        total_documents: 0,
        total_projects: 0,
        total_equipment: 0,
        active_users_last_30_days: 0,
        new_households_last_30_days: 0,
        storage_usage_mb: 0,
      };

      // TODO: Uncomment when migration is applied
      // const { data, error: statsError } = await client.rpc('get_system_stats');
      // if (statsError) throw statsError;
      // setStats(data);
      
      setStats(mockStats);
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