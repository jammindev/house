// packages/shared/src/index.ts
// shared/src/index.ts
// Types
export * from './types'
export * from './types/contacts'

// Features
export * from './features'

// Supabase clients
export * from './supabase/unified'
export * from './supabase/client-native'

// Hooks réutilisables
export * from './hooks/useTodos'
// export * from './hooks/useContacts' // TODO: implement this hook

// Lib utilitaires
export * from './lib/contacts'

// Fonctions utilitaires simples que nous pouvons partager
export function cn(...inputs: any[]): string {
    return inputs.filter(Boolean).join(' ')
}