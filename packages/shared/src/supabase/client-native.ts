// shared/src/supabase/client-native.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types'
import { SassClient, ClientType } from './unified'

interface SupabaseConfig {
    url: string
    anonKey: string
    storage?: any // AsyncStorage injecté depuis l'app mobile
}

export function createNativeClient(config?: SupabaseConfig) {
    // Les variables d'environnement seront injectées depuis l'app mobile
    const supabaseUrl = config?.url || ''
    const supabaseAnonKey = config?.anonKey || ''

    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
            // Configuration spécifique pour React Native
            storage: config?.storage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    })
}

export async function createNativeSassClient(config?: SupabaseConfig) {
    const client = createNativeClient(config)
    return new SassClient(client, ClientType.SPA)
}

export async function createNativeSassClientAuthenticated(config?: SupabaseConfig) {
    const client = createNativeClient(config)
    const { data: session } = await client.auth.getSession()

    if (!session?.session) {
        // Dans React Native, on ne peut pas rediriger comme sur le web
        // On laisse le composant parent gérer la navigation
        throw new Error('UNAUTHORIZED')
    }

    return new SassClient(client, ClientType.SPA)
}