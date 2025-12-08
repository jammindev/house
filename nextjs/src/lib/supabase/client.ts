import { createBrowserClient } from '@supabase/ssr'
import { ClientType, SassClient } from "@/lib/supabase/unified";
import { Database } from "@/lib/types-generated";

let _supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createSPAClient() {
    if (!_supabaseClient) {
        _supabaseClient = createBrowserClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
    }
    return _supabaseClient;
}

// utilitaire pour forcer la recréation (logout / changement d'env)
export function resetSPAClient() {
    _supabaseClient = null;
}

export async function createSPASassClient() {
    const client = createSPAClient();
    return new SassClient(client, ClientType.SPA);
}

export async function createSPASassClientAuthenticated() {
    const client = createSPAClient();
    const user = await client.auth.getSession();
    if (!user.data || !user.data.session) {
        window.location.href = '/auth/login';
    }
    return new SassClient(client, ClientType.SPA);
}