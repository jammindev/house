// nextjs/src/lib/context/GlobalContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, useMemo } from 'react';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/types';

export type User = {
    email: string;
    id: string;
    registered_at: Date;
};

export type Household = {
    id: string;
    name: string;
};

export interface GlobalContextType {
    loading: boolean;
    user: User | null;
    households: Household[];
    selectedHouseholdId: string | null;
    setSelectedHouseholdId: (id: string | null) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [selectedHouseholdId, _setSelectedHouseholdId] = useState<string | null>(() => {
        if (typeof window === 'undefined') {
            return null;
        }
        try {
            return localStorage.getItem('selectedHouseholdId');
        } catch {
            return null;
        }
    });

    const selectedHouseholdIdRef = useRef<string | null>(selectedHouseholdId);
    useEffect(() => {
        selectedHouseholdIdRef.current = selectedHouseholdId;
    }, [selectedHouseholdId]);

    const setSelectedHouseholdId = useCallback((id: string | null) => {
        _setSelectedHouseholdId((previous) => {
            if (previous === id) {
                return previous;
            }

            try {
                if (id) {
                    localStorage.setItem('selectedHouseholdId', id);
                } else {
                    localStorage.removeItem('selectedHouseholdId');
                }
            } catch (loadError) {
                console.error('Error loading global context data:', loadError);
            }

            return id;
        });
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            try {
                const supabase = await createSPASassClient();
                const client = supabase.getSupabaseClient();

                const [userResult, householdsResult] = await Promise.all([
                    client.auth.getUser(),
                    client
                        .from('households')
                        .select('id, name')
                        .order('created_at')
                ]);

                if (!isMounted) {
                    return;
                }

                if (userResult.error) {
                    console.error('Error loading user:', userResult.error);
                    setUser(null);
                } else if (userResult.data.user) {
                    const fetchedUser = userResult.data.user;
                    setUser({
                        email: fetchedUser.email!,
                        id: fetchedUser.id,
                        registered_at: new Date(fetchedUser.created_at)
                    });
                } else {
                    setUser(null);
                }

                if (householdsResult.error) {
                    console.error('Error loading households:', householdsResult.error);
                    setHouseholds([]);
                    setSelectedHouseholdId(null);
                    return;
                }

                type HouseholdRow = Pick<Database['public']['Tables']['households']['Row'], 'id' | 'name'>;
                const fetchedHouseholds: Household[] =
                    (householdsResult.data as HouseholdRow[] | null)?.map((household) => ({
                        id: household.id,
                        name: household.name,
                    })) ?? [];
                setHouseholds(fetchedHouseholds);

                if (!fetchedHouseholds.length) {
                    setSelectedHouseholdId(null);
                    return;
                }

                const currentSelection = selectedHouseholdIdRef.current;
                if (currentSelection && fetchedHouseholds.some((household) => household.id === currentSelection)) {
                    setSelectedHouseholdId(currentSelection);
                    return;
                }

                setSelectedHouseholdId(fetchedHouseholds[0].id);
            } catch (error) {
                console.error('Error loading global context data:', error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadData();

        return () => {
            isMounted = false;
        };
    }, [setSelectedHouseholdId]);

    const value = useMemo(
        () => ({ loading, user, households, selectedHouseholdId, setSelectedHouseholdId }),
        [loading, user, households, selectedHouseholdId, setSelectedHouseholdId]
    );

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    );
}

export const useGlobal = () => {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobal must be used within a GlobalProvider');
    }
    return context;
};
