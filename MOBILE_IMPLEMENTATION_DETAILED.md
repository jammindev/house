# 🔧 MOBILE_IMPLEMENTATION_DETAILED.md — Guide Technique Détaillé

Ce document complète `MOBILE_ARCHITECTURE.md` avec des détails techniques précis sur l'implémentation de l'application mobile House.

## 🎯 Rappel des Objectifs

### Inspiration Next.js
L'application mobile **DOIT** reproduire exactement la même expérience que l'application Next.js existante :
- **Structure identique** : Chaque page Next.js a son équivalent mobile
- **Fonctionnalités identiques** : Même logique métier, même données
- **Code partagé maximum** : Via le package `shared/`

## 📁 Structure Détaillée des Dossiers

### mobile/src/
```
mobile/src/
├── App.tsx                   # Point d'entrée avec AuthProvider
├── navigation/
│   └── AppNavigator.tsx      # Navigation principale avec auth/main
├── screens/                  # Écrans organisés par feature
│   ├── auth/
│   │   └── LoginScreen.tsx   # Équivalent nextjs/src/app/auth/login
│   ├── dashboard/
│   │   └── DashboardScreen.tsx # Équivalent nextjs/src/app/app/dashboard
│   ├── interactions/
│   │   ├── InteractionsScreen.tsx    # Liste des interactions
│   │   └── InteractionDetailScreen.tsx # Détail d'une interaction
│   ├── zones/
│   │   ├── ZonesScreen.tsx           # Gestion des zones
│   │   └── ZoneDetailScreen.tsx      # Détail d'une zone
│   ├── projects/
│   │   ├── ProjectsScreen.tsx        # Liste des projets
│   │   └── ProjectDetailScreen.tsx   # Détail d'un projet
│   ├── tasks/
│   │   └── TasksScreen.tsx           # Board Kanban des tâches
│   └── MainScreen.tsx        # Écran temporaire pour tests
├── components/
│   ├── ui/                   # Composants de base (équivalents shadcn/ui)
│   │   ├── index.ts
│   │   ├── button/
│   │   │   ├── index.ts
│   │   │   └── Button.tsx    # StyleSheet + TouchableOpacity
│   │   ├── input/
│   │   │   ├── index.ts
│   │   │   └── Input.tsx     # TextInput + validation
│   │   └── card/
│   │       ├── index.ts
│   │       └── Card.tsx      # View + styling
│   └── layout/               # Composants de layout
│       ├── SafeArea.tsx      # SafeAreaView wrapper
│       └── Header.tsx        # Headers d'écrans
├── contexts/
│   └── AuthContext.tsx       # Gestion globale de l'authentification
├── config/
│   └── supabase.ts          # Configuration Supabase pour mobile
└── hooks/                   # Hooks spécifiques mobile (navigation, etc.)
    └── useNavigation.ts     # Hooks de navigation typés
```

### shared/src/
```
shared/src/
├── index.ts                 # Export centralisé
├── types.ts                 # Types générés par Supabase CLI
├── supabase/
│   ├── unified.ts          # SassClient classe unifiée
│   ├── client-web.ts       # Client pour Next.js
│   └── client-native.ts    # Client pour React Native
└── hooks/                  # Hooks métier réutilisables
    ├── useTodos.ts         # Exemple fonctionnel
    ├── useInteractions.ts  # À implémenter
    ├── useZones.ts         # À implémenter
    ├── useProjects.ts      # À implémenter
    └── useAuth.ts          # Logique d'auth partagée
```

## 🔄 Détails du Package Shared

### Configuration Supabase Multi-plateforme

#### shared/src/supabase/client-native.ts
```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types'
import { SassClient, ClientType } from './unified'

interface SupabaseConfig {
    url: string
    anonKey: string
    storage?: any // AsyncStorage injecté depuis mobile
}

export function createNativeClient(config?: SupabaseConfig) {
    const supabaseUrl = config?.url || ''
    const supabaseAnonKey = config?.anonKey || ''
    
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
            storage: config?.storage, // AsyncStorage depuis mobile
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false, // Pas de URL detection mobile
        },
    })
}
```

#### mobile/src/config/supabase.ts
```typescript
import 'react-native-url-polyfill/auto' // OBLIGATOIRE pour Supabase
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNativeSassClient, createNativeSassClientAuthenticated } from '@house/shared'

const supabaseConfig = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    storage: AsyncStorage, // Injection de dépendance
}

export const createSupabaseClient = () => createNativeSassClient(supabaseConfig)
export const createSupabaseClientAuthenticated = () => createNativeSassClientAuthenticated(supabaseConfig)
```

### Hooks Métier Partagés (Pattern à suivre)

#### Exemple : shared/src/hooks/useInteractions.ts
```typescript
import { useState, useEffect } from 'react'
import { createNativeSassClientAuthenticated } from '../supabase/client-native'
import { Interaction } from '../types'

export function useInteractions(householdId: string) {
    const [interactions, setInteractions] = useState<Interaction[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadInteractions = async () => {
        try {
            setLoading(true)
            setError(null)
            
            const client = await createNativeSassClientAuthenticated()
            const { data, error } = await client.getSupabaseClient()
                .from('interactions')
                .select('*')
                .eq('household_id', householdId)
                .order('occurred_at', { ascending: false })
                .limit(50)

            if (error) throw error
            setInteractions(data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }

    const createInteraction = async (interaction: Omit<Interaction, 'id'>) => {
        try {
            const client = await createNativeSassClientAuthenticated()
            const { data, error } = await client.getSupabaseClient()
                .from('interactions')
                .insert([interaction])
                .select()

            if (error) throw error
            if (data) {
                setInteractions(prev => [data[0], ...prev])
            }
            return { success: true, data: data?.[0] }
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Erreur' }
        }
    }

    useEffect(() => {
        if (householdId) {
            loadInteractions()
        }
    }, [householdId])

    return {
        interactions,
        loading,
        error,
        loadInteractions,
        createInteraction,
    }
}
```

## 📱 Navigation Détaillée

### Structure de Navigation Complète

#### mobile/src/navigation/AppNavigator.tsx
```typescript
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, ActivityIndicator } from 'react-native'

// Screens imports
import { LoginScreen } from '../screens/auth/LoginScreen'
import { DashboardScreen } from '../screens/dashboard/DashboardScreen'
import { InteractionsScreen } from '../screens/interactions/InteractionsScreen'
import { InteractionDetailScreen } from '../screens/interactions/InteractionDetailScreen'
import { ZonesScreen } from '../screens/zones/ZonesScreen'
import { ProjectsScreen } from '../screens/projects/ProjectsScreen'
import { TasksScreen } from '../screens/tasks/TasksScreen'
import { useAuth } from '../contexts/AuthContext'

// Type definitions
export type RootStackParamList = {
    Auth: undefined
    Main: undefined
}

export type AuthStackParamList = {
    Login: undefined
    Register: undefined
}

export type MainTabParamList = {
    Dashboard: undefined
    Interactions: undefined
    Zones: undefined
    Projects: undefined
    Tasks: undefined
}

export type InteractionsStackParamList = {
    InteractionsList: undefined
    InteractionDetail: { id: string }
}

const RootStack = createStackNavigator<RootStackParamList>()
const AuthStack = createStackNavigator<AuthStackParamList>()
const MainTab = createBottomTabNavigator<MainTabParamList>()
const InteractionsStack = createStackNavigator<InteractionsStackParamList>()

// Navigation Stack pour Interactions
function InteractionsNavigator() {
    return (
        <InteractionsStack.Navigator>
            <InteractionsStack.Screen 
                name="InteractionsList" 
                component={InteractionsScreen}
                options={{ title: 'Interactions' }}
            />
            <InteractionsStack.Screen 
                name="InteractionDetail" 
                component={InteractionDetailScreen}
                options={{ title: 'Détail' }}
            />
        </InteractionsStack.Navigator>
    )
}

function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
    )
}

function MainNavigator() {
    return (
        <MainTab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopColor: '#e4e4e7',
                },
                tabBarActiveTintColor: '#18181b',
                tabBarInactiveTintColor: '#71717a',
            }}
        >
            <MainTab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{ tabBarLabel: 'Accueil' }}
            />
            <MainTab.Screen
                name="Interactions"
                component={InteractionsNavigator}
                options={{ tabBarLabel: 'Interactions' }}
            />
            <MainTab.Screen
                name="Zones"
                component={ZonesScreen}
                options={{ tabBarLabel: 'Zones' }}
            />
            <MainTab.Screen
                name="Projects"
                component={ProjectsScreen}
                options={{ tabBarLabel: 'Projets' }}
            />
            <MainTab.Screen
                name="Tasks"
                component={TasksScreen}
                options={{ tabBarLabel: 'Tâches' }}
            />
        </MainTab.Navigator>
    )
}

export function AppNavigator() {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 16 }}>Chargement...</Text>
            </View>
        )
    }

    return (
        <NavigationContainer>
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    <RootStack.Screen name="Main" component={MainNavigator} />
                ) : (
                    <RootStack.Screen name="Auth" component={AuthNavigator} />
                )}
            </RootStack.Navigator>
        </NavigationContainer>
    )
}
```

## 🎨 Composants UI Détaillés

### Patterns de Composants (Équivalents shadcn/ui)

#### mobile/src/components/ui/button/Button.tsx
```typescript
import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'

interface ButtonProps {
    onPress: () => void
    children: React.ReactNode
    variant?: 'default' | 'outline' | 'ghost' | 'destructive'
    size?: 'default' | 'sm' | 'lg'
    disabled?: boolean
    style?: ViewStyle
}

export function Button({ 
    onPress, 
    children, 
    variant = 'default', 
    size = 'default',
    disabled = false,
    style,
    ...props 
}: ButtonProps) {
    return (
        <TouchableOpacity
            style={[
                styles.button,
                styles[variant],
                styles[size],
                disabled && styles.disabled,
                style
            ]}
            onPress={onPress}
            disabled={disabled}
            {...props}
        >
            <Text style={[
                styles.text,
                styles[`${variant}Text`],
                styles[`${size}Text`],
                disabled && styles.disabledText
            ]}>
                {children}
            </Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    button: {
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Variants
    default: {
        backgroundColor: '#09090b',
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#e4e4e7',
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    destructive: {
        backgroundColor: '#ef4444',
    },
    // Sizes
    sm: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    lg: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    // Disabled
    disabled: {
        opacity: 0.5,
    },
    // Text styles
    text: {
        fontSize: 16,
        fontWeight: '500',
    },
    defaultText: {
        color: '#ffffff',
    },
    outlineText: {
        color: '#09090b',
    },
    ghostText: {
        color: '#09090b',
    },
    destructiveText: {
        color: '#ffffff',
    },
    smText: {
        fontSize: 14,
    },
    lgText: {
        fontSize: 18,
    },
    disabledText: {
        opacity: 0.5,
    },
})
```

#### mobile/src/components/ui/input/Input.tsx
```typescript
import React, { useState } from 'react'
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native'

interface InputProps extends TextInputProps {
    label?: string
    error?: string
    helperText?: string
}

export function Input({ label, error, helperText, style, ...props }: InputProps) {
    const [isFocused, setIsFocused] = useState(false)

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    isFocused && styles.inputFocused,
                    error && styles.inputError,
                    style
                ]}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholderTextColor="#71717a"
                {...props}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090b',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e4e4e7',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
        backgroundColor: '#ffffff',
        color: '#09090b',
    },
    inputFocused: {
        borderColor: '#09090b',
    },
    inputError: {
        borderColor: '#ef4444',
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
        marginTop: 4,
    },
    helperText: {
        fontSize: 12,
        color: '#71717a',
        marginTop: 4,
    },
})
```

## 🔐 Authentification Complète

### mobile/src/contexts/AuthContext.tsx
```typescript
import React, { createContext, useContext, useEffect, useState } from 'react'
import { createSupabaseClient } from '../config/supabase'

interface User {
    id: string
    email?: string
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
```

## 📋 Templates d'Écrans

### Template d'Écran de Base
```typescript
// mobile/src/screens/[feature]/[Feature]Screen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui'

export function FeatureScreen() {
    const { user } = useAuth()

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.header}>
                    <Text style={styles.title}>Feature Title</Text>
                    <Text style={styles.subtitle}>Feature description</Text>
                </View>

                <View style={styles.content}>
                    {/* Contenu principal */}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#09090b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#71717a',
    },
    content: {
        padding: 20,
        paddingTop: 10,
    },
})
```

## 🛠️ Configuration & Variables d'Environnement

### mobile/.env
```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Configuration
EXPO_PUBLIC_APP_NAME=House
EXPO_PUBLIC_APP_VERSION=1.0.0
```

### mobile/app.json
```json
{
  "expo": {
    "name": "House",
    "slug": "house-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.house.mobile"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.house.mobile"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## 🧪 Testing & Debugging

### Commandes de Développement
```bash
# Démarrage de l'app
cd mobile && npm start

# Recompilation du package shared
cd shared && npm run build

# Régénération des types Supabase
npx supabase gen types typescript --linked

# Debugging avec logs
npx expo start --dev-client

# Clear cache
npx expo start --clear
```

### Debugging Patterns
```typescript
// Logging pour mobile
console.log('[DEBUG] Component mounted:', componentName)
console.error('[ERROR] API call failed:', error)

// Vérification des variables d'env
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL)

// Navigation debugging
import { useNavigation } from '@react-navigation/native'
const navigation = useNavigation()
console.log('Current route:', navigation.getState())
```

Ce document technique fournit tous les détails nécessaires pour implémenter correctement l'application mobile en suivant les patterns établis et en reproduisant fidèlement l'expérience Next.js.