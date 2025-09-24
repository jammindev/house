// src/lib/context/GlobalContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';


type User = {
    email: string;
    id: string;
    registered_at: Date;
};

type Household = {
    id: string;
    name: string;
};

interface GlobalContextType {
    loading: boolean;
    user: User | null;
    households: Household[];
    selectedHouseholdId: string | null;
    setSelectedHouseholdId: (id: string | null) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [selectedHouseholdId, _setSelectedHouseholdId] = useState<string | null>(null);

    const setSelectedHouseholdId = (id: string | null) => {
        _setSelectedHouseholdId(id);
        try {
            if (id) {
                localStorage.setItem('selectedHouseholdId', id);
            } else {
                localStorage.removeItem('selectedHouseholdId');
            }
        } catch (e) {
            // ignore storage errors
        }
    };

    useEffect(() => {
        async function loadData() {
            try {
                const supabase = await createSPASassClient();
                const client = supabase.getSupabaseClient();

                // Get user data
                const { data: { user } } = await client.auth.getUser();
                if (user) {
                    setUser({
                        email: user.email!,
                        id: user.id,
                        registered_at: new Date(user.created_at)
                    });
                } else {
                    throw new Error('User not found');
                }

                // Load households visible to this user (RLS enforced)
                const { data: hhData, error: hhErr } = await client
                    .from('households' as any)
                    .select('id, name')
                    .order('created_at' as any);
                if (hhErr) {
                    console.error('Error loading households:', hhErr);
                    setHouseholds([]);
                } else {
                    const hh = (hhData || []) as any[];
                    setHouseholds(hh as Household[]);

                    // Determine selected household
                    let selected: string | null = null;
                    try {
                        const stored = localStorage.getItem('selectedHouseholdId');
                        if (stored && hh.some(h => h.id === stored)) {
                            selected = stored;
                        }
                    } catch (e) {
                        // ignore
                    }
                    if (!selected) {
                        if (hh.length === 1) selected = hh[0].id;
                    }
                    if (selected) setSelectedHouseholdId(selected);
                }

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    return (
        <GlobalContext.Provider value={{ loading, user, households, selectedHouseholdId, setSelectedHouseholdId }}>
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
