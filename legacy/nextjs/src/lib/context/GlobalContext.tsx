// nextjs/src/lib/context/GlobalContext.tsx

"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';

export type User = {
    email: string;
    id: string;
    registered_at: Date;
    displayName: string | null;
    avatarPath: string | null;
    avatarUrl: string | null;
};
export type Household = { id: string; name: string; };

export interface GlobalContextType {
    loading: boolean;
    user: User | null;
    households: Household[];
    selectedHouseholdId: string | null;
    setSelectedHouseholdId: (id: string | null) => void;
    refreshUser: () => Promise<void>;
    refreshHouseholds: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60 * 6; // 6 hours

const extractDisplayName = (authUser: SupabaseUser) =>
    typeof authUser.user_metadata?.display_name === 'string'
        ? authUser.user_metadata.display_name
        : null;

const extractAvatarPath = (authUser: SupabaseUser) =>
    typeof authUser.user_metadata?.avatar_path === 'string' && authUser.user_metadata.avatar_path.length > 0
        ? authUser.user_metadata.avatar_path
        : null;

async function createAvatarSignedUrl(client: SupabaseClient, avatarPath: string | null): Promise<string | null> {
    if (!avatarPath) return null;
    try {
        const { data, error } = await client.storage
            .from('avatars')
            .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);
        if (error) {
            console.warn('avatar signed url error', error);
            return null;
        }
        return data?.signedUrl ?? null;
    } catch (err) {
        console.warn('avatar signed url error', err);
        return null;
    }
}

async function loadAuthenticatedUser(client: SupabaseClient): Promise<User | null> {
    const { data } = await client.auth.getUser();
    const authUser = data.user;
    if (!authUser) return null;

    const avatarPath = extractAvatarPath(authUser);
    const avatarUrl = await createAvatarSignedUrl(client, avatarPath);

    return {
        email: authUser.email ?? '',
        id: authUser.id,
        registered_at: new Date(authUser.created_at),
        displayName: extractDisplayName(authUser),
        avatarPath,
        avatarUrl,
    };
}

export function GlobalProvider({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUserState] = useState<User | null>(null);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [selectedHouseholdId, _setSelectedHouseholdId] = useState<string | null>(null);

    const selectedRef = useRef<string | null>(selectedHouseholdId);
    useEffect(() => { selectedRef.current = selectedHouseholdId; }, [selectedHouseholdId]);

    const setSelectedHouseholdId = useCallback((id: string | null) => {
        _setSelectedHouseholdId(prev => {
            if (prev === id) return prev;
            try {
                if (id) {
                    localStorage.setItem('selectedHouseholdId', id);
                } else {
                    localStorage.removeItem('selectedHouseholdId');
                }
            } catch {
                // ignore storage errors
            }
            return id;
        });
    }, []);

    const refreshUser = useCallback(async () => {
        const spa = await createSPASassClient();
        const supa = spa.getSupabaseClient();
        const nextUser = await loadAuthenticatedUser(supa);
        setUserState(nextUser);
    }, []);

    const refreshHouseholds = useCallback(async () => {
        const spa = await createSPASassClient();
        const supa = spa.getSupabaseClient();

        const { data: householdsData, error } = await supa.from('households').select('id, name').order('created_at');
        if (!error && householdsData) {
            const mapped = householdsData.map(h => ({ id: h.id, name: h.name })) as Household[];
            setHouseholds(mapped);

            // If current selected household is no longer available, reset selection
            const current = selectedRef.current;
            const stillExists = current && mapped.some(h => h.id === current);
            if (!stillExists) {
                setSelectedHouseholdId(mapped[0]?.id ?? null);
            }
        }
    }, [setSelectedHouseholdId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const spa = await createSPASassClient();
                const supa = spa.getSupabaseClient();

                const nextUser = await loadAuthenticatedUser(supa);
                if (!nextUser) { setUserState(null); setHouseholds([]); setSelectedHouseholdId(null); return; }

                setUserState(nextUser);

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
    }, [setSelectedHouseholdId]);

    const value = useMemo(() => ({ loading, user, households, selectedHouseholdId, setSelectedHouseholdId, refreshUser, refreshHouseholds }),
        [loading, user, households, selectedHouseholdId, setSelectedHouseholdId, refreshUser, refreshHouseholds]);

    return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export const useGlobal = () => {
    const ctx = useContext(GlobalContext);
    if (!ctx) throw new Error('useGlobal must be used within a GlobalProvider');
    return ctx;
};
