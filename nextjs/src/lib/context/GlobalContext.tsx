// nextjs/src/lib/context/GlobalContext.tsx
// src/lib/context/GlobalContext.tsx
"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';

export type User = { email: string; id: string; registered_at: Date; };
export type Household = { id: string; name: string; };

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
    const [selectedHouseholdId, _setSelectedHouseholdId] = useState<string | null>(null);

    const selectedRef = useRef<string | null>(selectedHouseholdId);
    useEffect(() => { selectedRef.current = selectedHouseholdId; }, [selectedHouseholdId]);

    const setSelectedHouseholdId = useCallback((id: string | null) => {
        _setSelectedHouseholdId(prev => {
            if (prev === id) return prev;
            try { id ? localStorage.setItem('selectedHouseholdId', id) : localStorage.removeItem('selectedHouseholdId'); } catch { }
            return id;
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const spa = await createSPASassClient();
                const supa = spa.getSupabaseClient();

                const { data: { user: authUser } } = await supa.auth.getUser();
                if (!authUser) { setUser(null); setHouseholds([]); setSelectedHouseholdId(null); return; }

                setUser({ email: authUser.email ?? '', id: authUser.id, registered_at: new Date(authUser.created_at) });

                const { data: householdsData, error } = await supa.from('households').select('id, name').order('created_at');
                if (!error && householdsData) {
                    const mapped = householdsData.map(h => ({ id: h.id, name: h.name })) as Household[];
                    setHouseholds(mapped);

                    const stored = localStorage.getItem('selectedHouseholdId');
                    const valid = stored && mapped.some(h => h.id === stored);
                    _setSelectedHouseholdId(valid ? stored! : (mapped[0]?.id ?? null));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const value = useMemo(() => ({ loading, user, households, selectedHouseholdId, setSelectedHouseholdId }),
        [loading, user, households, selectedHouseholdId, setSelectedHouseholdId]);

    return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export const useGlobal = () => {
    const ctx = useContext(GlobalContext);
    if (!ctx) throw new Error('useGlobal must be used within a GlobalProvider');
    return ctx;
};