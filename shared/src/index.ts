// shared/src/index.ts
// Types
export * from './types'
export * from './types/contacts'

// Supabase clients
export * from './supabase/unified'
export * from './supabase/client-native'

// Hooks réutilisables
export * from './hooks/useTodos'
export * from './hooks/useContacts'

// Lib utilitaires
export * from './lib/contacts'

// Fonctions utilitaires simples que nous pouvons partager
export function cn(...inputs: any[]): string {
    return inputs.filter(Boolean).join(' ')
}