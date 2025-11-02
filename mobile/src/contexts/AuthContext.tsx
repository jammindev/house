// mobile/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { createSupabaseClient } from '../config/supabase'

interface User {
    id: string
    email?: string
    // Ajoutez d'autres propriétés selon vos besoins
}

interface AuthContextType {
    user: User | null
    isLoading: boolean
    signIn: (email: string, password: string) => Promise<{ error?: any }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

interface AuthProviderProps {
    children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Vérifier la session existante au démarrage
        checkSession()
    }, [])

    const checkSession = async () => {
        try {
            const client = await createSupabaseClient()
            const { data: { session } } = await client.getSupabaseClient().auth.getSession()

            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email,
                })
            }
        } catch (error) {
            console.error('Erreur lors de la vérification de session:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const signIn = async (email: string, password: string) => {
        try {
            const client = await createSupabaseClient()
            const result = await client.loginEmail(email, password)

            if (result.error) {
                return { error: result.error }
            }

            if (result.data.user) {
                setUser({
                    id: result.data.user.id,
                    email: result.data.user.email,
                })
            }

            return {}
        } catch (error) {
            return { error }
        }
    }

    const signOut = async () => {
        try {
            const client = await createSupabaseClient()
            await client.logout()
            setUser(null)
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error)
        }
    }

    const value = {
        user,
        isLoading,
        signIn,
        signOut,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}