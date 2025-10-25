// nextjs/src/app/app/layout.tsx
// src/app/app/layout.tsx
import AppLayout from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ToastProvider';
import { GlobalProvider, type Household, type User } from '@/lib/context/GlobalContext';
import { createSSRClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types';

type HouseholdRow = Pick<Database['public']['Tables']['households']['Row'], 'id' | 'name'>;

export default async function Layout({ children }: { children: React.ReactNode }) {
    const supabase = await createSSRClient();

    const {
        data: { user: authUser },
        error: userError,
    } = await supabase.auth.getUser();

    let initialUser: User | null = null;
    let initialHouseholds: Household[] = [];

    if (!userError && authUser) {
        initialUser = {
            email: authUser.email ?? '',
            id: authUser.id,
            registered_at: new Date(authUser.created_at),
        };

        const { data: householdsData, error: householdsError } = await supabase
            .from('households')
            .select('id, name')
            .order('created_at');

        if (!householdsError && householdsData) {
            initialHouseholds =
                (householdsData as HouseholdRow[]).map((household) => ({
                    id: household.id,
                    name: household.name,
                })) ?? [];
        } else if (householdsError) {
            console.error('Error loading households on server:', householdsError);
        }
    } else if (userError) {
        console.error('Error loading user on server:', userError);
    }

    const initialSelectedHouseholdId = initialHouseholds[0]?.id ?? null;

    return (
        <GlobalProvider
            initialUser={initialUser}
            initialHouseholds={initialHouseholds}
            initialSelectedHouseholdId={initialSelectedHouseholdId}
        >
            <ToastProvider>
                <AppLayout>{children}</AppLayout>
            </ToastProvider>
        </GlobalProvider>
    );
}
