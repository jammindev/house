// mobile/src/hooks/useStructures.ts
import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClientAuthenticated } from '../config/supabase';
import type { Structure } from '../types/structure';

export function useStructures() {
    const [structures, setStructures] = useState<Structure[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStructures = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const supabaseClient = await createSupabaseClientAuthenticated();
            const client = supabaseClient.getSupabaseClient();

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
                setStructures([]);
                return;
            }

            const householdId = memberships[0].household_id;
            console.log('Fetching structures for household:', householdId);

            // Utiliser le client Supabase direct avec any pour contourner les types
            const supabase = client as any;

            // Récupérer les structures
            const { data: basicStructures, error: structuresError } = await supabase
                .from('structures')
                .select('*')
                .eq('household_id', householdId)
                .order('name');

            if (structuresError) throw structuresError;

            if (!basicStructures || basicStructures.length === 0) {
                setStructures([]);
                return;
            }

            // Récupérer les emails pour toutes les structures
            const structureIds = basicStructures.map((s: any) => s.id);
            const { data: emails } = await supabase
                .from('emails')
                .select('*')
                .in('structure_id', structureIds);

            // Récupérer les phones pour toutes les structures
            const { data: phones } = await supabase
                .from('phones')
                .select('*')
                .in('structure_id', structureIds);

            // Récupérer les adresses pour toutes les structures
            const { data: addresses } = await supabase
                .from('addresses')
                .select('*')
                .in('structure_id', structureIds);

            // Assembler les données
            const formattedStructures: Structure[] = basicStructures.map((structure: any) => {
                const structureEmails = (emails || []).filter((e: any) => e.structure_id === structure.id);
                const structurePhones = (phones || []).filter((p: any) => p.structure_id === structure.id);
                const structureAddresses = (addresses || []).filter((a: any) => a.structure_id === structure.id);

                return {
                    id: structure.id,
                    household_id: structure.household_id,
                    name: structure.name || '',
                    type: structure.type || 'organization',
                    description: structure.description || null,
                    website: structure.website || null,
                    tags: structure.tags || [],
                    created_at: structure.created_at,
                    updated_at: structure.updated_at,
                    emails: structureEmails.map((e: any) => ({
                        id: e.id,
                        email: e.email,
                        label: e.label,
                        is_primary: e.is_primary,
                        created_at: e.created_at
                    })),
                    phones: structurePhones.map((p: any) => ({
                        id: p.id,
                        phone: p.phone,
                        label: p.label,
                        is_primary: p.is_primary,
                        created_at: p.created_at
                    })),
                    addresses: structureAddresses.map((a: any) => ({
                        id: a.id,
                        address_1: a.line1 || a.address_1 || '',
                        address_2: a.line2 || a.address_2 || null,
                        zipcode: a.postal_code || a.zipcode || null,
                        city: a.city || null,
                        country: a.country || null,
                        label: a.label || null,
                        is_primary: a.is_primary || false,
                        created_at: a.created_at
                    })),
                };
            });

            console.log(`Loaded ${formattedStructures.length} structures`);
            setStructures(formattedStructures);

        } catch (err) {
            console.error('Error fetching structures:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching structures');

            // Message d'info en cas d'erreur
            setStructures([
                {
                    id: 'error-1',
                    household_id: 'error',
                    name: '⚠️ Erreur de chargement',
                    type: 'error',
                    description: err instanceof Error ? err.message : 'Erreur inconnue',
                    website: null,
                    tags: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    emails: [],
                    phones: [],
                    addresses: [],
                }
            ]);
        } finally {
            setLoading(false);
        }
    }, []); useEffect(() => {
        fetchStructures();
    }, [fetchStructures]);

    const refetch = useCallback(() => {
        fetchStructures();
    }, [fetchStructures]);

    return {
        structures,
        loading,
        error,
        refetch,
    };
}