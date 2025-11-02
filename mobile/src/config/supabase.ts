// mobile/src/config/supabase.ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNativeSassClient, createNativeSassClientAuthenticated } from '@house/shared'

const supabaseConfig = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    storage: AsyncStorage,
}

export const createSupabaseClient = () => createNativeSassClient(supabaseConfig)
export const createSupabaseClientAuthenticated = () => createNativeSassClientAuthenticated(supabaseConfig)