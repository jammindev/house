// nextjs/src/lib/context/GlobalContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, useMemo } from 'react';

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

interface GlobalProviderProps {
    children: ReactNode;
    initialUser: User | null;
    initialHouseholds: Household[];
    initialSelectedHouseholdId: string | null;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({
    children,
    initialUser,
    initialHouseholds,
    initialSelectedHouseholdId,
}: GlobalProviderProps) {
    const [user] = useState<User | null>(initialUser);
    const [households] = useState<Household[]>(initialHouseholds);
    const [selectedHouseholdId, _setSelectedHouseholdId] = useState<string | null>(initialSelectedHouseholdId);

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
                console.error('Error persisting selected household:', loadError);
            }

            return id;
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const storedSelection = localStorage.getItem('selectedHouseholdId');
            const hasStoredSelectionInList = storedSelection
                ? households.some((household) => household.id === storedSelection)
                : false;

            if (storedSelection && hasStoredSelectionInList && storedSelection !== selectedHouseholdIdRef.current) {
                _setSelectedHouseholdId(storedSelection);
                return;
            }

            if (storedSelection && !hasStoredSelectionInList) {
                localStorage.removeItem('selectedHouseholdId');
            }

            if (!storedSelection && !selectedHouseholdIdRef.current && households.length > 0) {
                _setSelectedHouseholdId(households[0].id);
            }
        } catch (error) {
            console.error('Error loading selected household from storage:', error);
        }
    }, [households]);

    const value = useMemo(
        () => ({
            loading: false,
            user,
            households,
            selectedHouseholdId,
            setSelectedHouseholdId,
        }),
        [households, selectedHouseholdId, setSelectedHouseholdId, user]
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
