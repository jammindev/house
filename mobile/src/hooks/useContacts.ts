// mobile/src/hooks/useContacts.ts
import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClientAuthenticated } from '../config/supabase';
import { useContacts as useSharedContacts } from '@house/shared';
import type { Contact } from '@house/shared';

export function useContacts() {
    const [householdId, setHouseholdId] = useState<string | null>(null);
    const [loadingHousehold, setLoadingHousehold] = useState(true);

    // Fonction pour récupérer le client Supabase
    const getSupabaseClient = useCallback(async () => {
        const supabaseClient = await createSupabaseClientAuthenticated();
        return supabaseClient.getSupabaseClient();
    }, []);

    // Fonction pour formater les messages d'erreur (simplifiée pour mobile)
    const getErrorMessage = useCallback((error: unknown, fallback: string) => {
        return error instanceof Error ? error.message : fallback;
    }, []);

    // Récupérer le household_id
    const fetchHouseholdId = useCallback(async () => {
        try {
            setLoadingHousehold(true);
            const client = await getSupabaseClient();

            // Récupérer l'utilisateur connecté
            const { data: { user }, error: userError } = await client.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error('User not authenticated');

            // Récupérer le premier household de l'utilisateur
            const { data: memberships, error: membershipError } = await client
                .from('household_members')
                .select('household_id')
                .eq('user_id', user.id)
                .limit(1);

            if (membershipError) throw membershipError;
            if (!memberships || memberships.length === 0) {
                setHouseholdId(null);
                return;
            }

            setHouseholdId(memberships[0].household_id);
        } catch (err) {
            console.error('Error fetching household:', err);
            setHouseholdId(null);
        } finally {
            setLoadingHousehold(false);
        }
    }, [getSupabaseClient]);

    // Utiliser le hook partagé
    const contactsResult = useSharedContacts({
        householdId,
        getSupabaseClient,
        getErrorMessage,
    });

    useEffect(() => {
        fetchHouseholdId();
    }, [fetchHouseholdId]);

    return {
        ...contactsResult,
        loading: loadingHousehold || contactsResult.loading,
    };
}