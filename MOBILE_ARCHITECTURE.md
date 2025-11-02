# 📱 MOBILE_ARCHITECTURE.md — Guide Complet pour IA

Ce document fournit une compréhension complète de l'architecture mobile du projet House, son inspiration Next.js, et les patterns de développement à suivre.

## 🎯 Vue d'ensemble

### Contexte du projet
- **Application originale** : Next.js 15 avec App Router (dans `nextjs/`)
- **Application mobile** : React Native avec Expo (dans `mobile/`)
- **Code partagé** : Package TypeScript réutilisable (dans `shared/`)
- **Objectif** : Reproduire fidèlement l'expérience Next.js sur mobile avec une architecture cohérente

### Principe fondamental
> **L'application mobile doit reproduire la même structure et fonctionnalités que l'app Next.js originale, en réutilisant le maximum de code via le package `shared/`.**

## 🏗️ Architecture Globale

```
house/
├── nextjs/                    # 🌐 Application web originale (Next.js 15)
│   ├── src/app/              # App Router Next.js
│   ├── src/components/       # Composants React web
│   ├── src/features/         # Features organisées par domaine
│   └── src/lib/              # Utilitaires et configurations
├── mobile/                   # 📱 Application mobile (React Native + Expo)
│   ├── src/screens/          # Équivalent de nextjs/src/app/ 
│   ├── src/components/       # Composants React Native
│   ├── src/navigation/       # Navigation React Navigation
│   ├── src/contexts/         # Contextes React (Auth, etc.)
│   └── src/config/           # Configuration mobile
├── shared/                   # 🔄 Code partagé entre web et mobile
│   ├── src/types.ts          # Types TypeScript Supabase
│   ├── src/supabase/         # Clients Supabase (web + mobile)
│   └── src/hooks/            # Hooks métier réutilisables
└── supabase/                 # 🗄️ Backend (RLS, migrations, etc.)
```

## 🌐 Application Next.js Originale (Référence)

### Structure Next.js
```
nextjs/src/app/
├── auth/                     # Authentification (login, register, 2FA)
├── app/                      # Application principale (dashboard)
│   ├── dashboard/            # Tableau de bord
│   ├── interactions/         # Gestion des interactions
│   ├── zones/                # Gestion des zones
│   ├── projects/             # Gestion des projets
│   ├── tasks/                # Gestion des tâches
│   └── user-settings/        # Paramètres utilisateur
└── api/                      # API routes Next.js
```

### Features Next.js
- **Dashboard** : Vue d'ensemble avec statistiques et actions rapides
- **Interactions** : Capture chronologique avec attachments et zones
- **Zones** : Hiérarchie spatiale avec couleurs et métadonnées
- **Projects** : Gestion de projets avec budgets et timeline
- **Tasks** : Board Kanban avec statuts
- **Auth** : Login/register avec MFA et session management

## 📱 Application Mobile (Réplication)

### Objectif architectural
Reproduire **exactement** la même structure que Next.js en adaptant les patterns pour React Native :

| Next.js Pattern | Mobile Équivalent | Responsabilité |
|----------------|------------------|----------------|
| `app/dashboard/page.tsx` | `screens/dashboard/DashboardScreen.tsx` | Écran principal |
| `app/interactions/page.tsx` | `screens/interactions/InteractionsScreen.tsx` | Liste des interactions |
| `app/zones/page.tsx` | `screens/zones/ZonesScreen.tsx` | Gestion des zones |
| App Router navigation | React Navigation | Navigation entre écrans |
| Server Components | Context + Hooks | Gestion d'état |
| `layout.tsx` | Navigation Stacks | Structure de navigation |

### Technologies Utilisées

#### Core Framework
- **React Native** : Framework de développement mobile
- **Expo** : Plateforme de développement et déploiement
- **TypeScript** : Typage statique

#### Navigation
- **React Navigation v7** : Navigation principale
  - `createStackNavigator` : Navigation en pile (auth/main)
  - `createBottomTabNavigator` : Navigation par onglets (dashboard, interactions, etc.)

#### État & Données
- **React Context** : Gestion d'état global (authentification)
- **React Hooks** : Gestion d'état local et effets
- **Package `shared/`** : Logique métier réutilisable

#### UI & Style
- **React Native Components** : Composants natifs
- **StyleSheet** : Styles React Native
- **Composants UI custom** : Équivalents shadcn/ui (Button, Input, Card)

#### Backend & Auth
- **Supabase** : Base de données et authentification
- **AsyncStorage** : Stockage local (sessions)
- **URL Polyfill** : Compatibilité Supabase

## 🔄 Package Shared (Code Réutilisable)

### Structure du package shared
```
shared/src/
├── types.ts                  # Types Supabase générés
├── supabase/
│   ├── unified.ts           # Classe SassClient unifiée
│   ├── client-web.ts        # Client pour Next.js
│   └── client-native.ts     # Client pour React Native
└── hooks/
    ├── useTodos.ts          # Hook exemple (todos)
    ├── useInteractions.ts   # Hook pour interactions
    └── useZones.ts          # Hook pour zones
```

### Patterns de Réutilisation

#### 1. Clients Supabase Adaptés
```typescript
// shared/src/supabase/client-native.ts
export function createNativeClient(config: SupabaseConfig) {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: config.storage, // AsyncStorage injecté depuis mobile
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}
```

#### 2. Hooks Métier Réutilisables
```typescript
// shared/src/hooks/useInteractions.ts
export function useInteractions(householdId: string) {
  // Logique commune web + mobile
  const [interactions, setInteractions] = useState([])
  
  const loadInteractions = async () => {
    // Logique Supabase réutilisée
  }
  
  return { interactions, loadInteractions, createInteraction }
}
```

#### 3. Types Unifiés
```typescript
// shared/src/types.ts
export type Database = // Types générés par Supabase CLI
export type Interaction = Database['public']['Tables']['interactions']['Row']
export type Zone = Database['public']['Tables']['zones']['Row']
```

## 📱 Navigation Mobile Détaillée

### Architecture de Navigation
```
AppNavigator (Root)
├── AuthStack (Non connecté)
│   └── LoginScreen
└── MainNavigator (Connecté)
    ├── DashboardTab
    ├── InteractionsTab
    ├── ZonesTab
    ├── ProjectsTab
    └── TasksTab
```

### Implémentation
```typescript
// mobile/src/navigation/AppNavigator.tsx
export function AppNavigator() {
  const { user, isLoading } = useAuth()
  
  return (
    <NavigationContainer>
      <RootStack.Navigator>
        {user ? (
          <RootStack.Screen name="Main" component={MainTabNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  )
}
```

### Correspondance avec Next.js Routes
| Next.js Route | Mobile Screen | Navigation Type |
|--------------|---------------|-----------------|
| `/app/dashboard` | `DashboardScreen` | Bottom Tab |
| `/app/interactions` | `InteractionsScreen` | Bottom Tab |
| `/app/interactions/[id]` | `InteractionDetailScreen` | Stack Push |
| `/app/zones` | `ZonesScreen` | Bottom Tab |
| `/auth/login` | `LoginScreen` | Auth Stack |

## 🎨 Composants UI (Équivalence shadcn/ui)

### Structure des Composants
```
mobile/src/components/ui/
├── index.ts              # Exports centralisés
├── button/
│   ├── index.ts
│   └── Button.tsx        # Équivalent shadcn Button
├── input/
│   ├── index.ts
│   └── Input.tsx         # Équivalent shadcn Input
└── card/
    ├── index.ts
    └── Card.tsx          # Équivalent shadcn Card
```

### Patterns de Composants
```typescript
// mobile/src/components/ui/button/Button.tsx
interface ButtonProps {
  onPress: () => void
  children: React.ReactNode
  variant?: 'default' | 'outline' | 'ghost'
  disabled?: boolean
}

export function Button({ onPress, children, variant = 'default', ...props }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant]]}
      onPress={onPress}
      {...props}
    >
      <Text style={[styles.text, styles[`${variant}Text`]]}>{children}</Text>
    </TouchableOpacity>
  )
}
```

## 🔐 Authentification Mobile

### Context d'Authentification
```typescript
// mobile/src/contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{error?: any}>
  signOut: () => Promise<void>
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  
  // Vérification session au démarrage
  useEffect(() => {
    checkSession()
  }, [])
  
  // Implémentation signIn/signOut avec Supabase
}
```

### Flux d'Authentification
1. **App Start** → Vérification session existante
2. **Login** → `signIn()` → Mise à jour du contexte → Navigation automatique
3. **Navigation** → `AppNavigator` utilise `user` du contexte
4. **Logout** → `signOut()` → Retour à l'écran de login

## 🎯 Patterns de Développement à Suivre

### 1. Correspondance Stricte Next.js ↔ Mobile

**Règle d'or** : Pour chaque page Next.js, créer un écran mobile équivalent

```
nextjs/src/app/interactions/page.tsx
  ↓ correspond à
mobile/src/screens/interactions/InteractionsScreen.tsx
```

### 2. Réutilisation via Package Shared

**Avant de créer une nouvelle logique :**
1. Vérifier si elle existe dans `shared/`
2. Si non, la créer dans `shared/` pour réutilisation
3. L'importer dans le mobile ET dans Next.js

### 3. Architecture par Features

**Organiser le code par domaine métier :**
```
mobile/src/
├── screens/           # Écrans par feature
│   ├── auth/
│   ├── dashboard/
│   ├── interactions/
│   └── zones/
├── components/        # Composants transversaux
└── hooks/             # Hooks spécifiques mobile (navigation, etc.)
```

### 4. Gestion d'État

**Ordre de priorité :**
1. **Shared hooks** : Logique métier réutilisable
2. **React Context** : État global (auth, theme)
3. **useState/useEffect** : État local d'écran

### 5. Navigation Patterns

**Types de navigation :**
- **Stack Navigation** : Pour les flows (auth, détails)
- **Tab Navigation** : Pour les sections principales
- **Modal** : Pour les actions (création, édition)

## 📝 Guide de Développement pour IA

### Étapes pour Ajouter une Nouvelle Feature

1. **Analyser l'équivalent Next.js**
   ```bash
   # Examiner la structure Next.js
   ls nextjs/src/app/[feature]/
   cat nextjs/src/app/[feature]/page.tsx
   ```

2. **Identifier le code réutilisable**
   ```bash
   # Vérifier si des hooks existent
   ls shared/src/hooks/use[Feature]*
   ```

3. **Créer l'écran mobile**
   ```bash
   # Reproduire la structure
   mkdir mobile/src/screens/[feature]/
   touch mobile/src/screens/[feature]/[Feature]Screen.tsx
   ```

4. **Ajouter la navigation**
   ```typescript
   // Mettre à jour AppNavigator.tsx
   import { FeatureScreen } from '../screens/feature/FeatureScreen'
   ```

5. **Tester la cohérence**
   ```bash
   # Vérifier que l'expérience est similaire
   npm run start # Dans mobile/
   ```

### Commandes Utiles

```bash
# Développement mobile
cd mobile && npm start                    # Lancer Expo
cd shared && npm run build               # Recompiler le package partagé

# Types Supabase
npx supabase gen types typescript --linked # Régénérer les types

# Structure
tree mobile/src -I node_modules          # Visualiser l'architecture
```

### Debugging Mobile

1. **Erreurs d'import** : Vérifier que `shared/` est compilé
2. **Erreurs Supabase** : Vérifier les variables d'environnement `.env`
3. **Navigation** : Utiliser React Navigation Debugger
4. **Performance** : Utiliser Flipper ou React DevTools

## 🚀 Roadmap de Développement

### Phase 1 : Core Features (En cours)
- [x] Authentification avec redirection
- [x] Navigation de base
- [x] Package shared fonctionnel
- [ ] Dashboard principal
- [ ] Interactions CRUD

### Phase 2 : Features Avancées
- [ ] Zones avec hiérarchie
- [ ] Projects avec timeline
- [ ] Tasks avec Kanban
- [ ] Upload de fichiers

### Phase 3 : Optimisations
- [ ] Synchronisation offline
- [ ] Notifications push
- [ ] Performance optimizations
- [ ] Tests E2E

## 📋 Checklist pour Nouvelles Features

### Avant de commencer
- [ ] Analyser l'équivalent Next.js existant
- [ ] Identifier les composants réutilisables
- [ ] Vérifier les hooks dans `shared/`
- [ ] Planifier la navigation

### Pendant le développement
- [ ] Créer l'écran avec la même structure que Next.js
- [ ] Utiliser les hooks partagés
- [ ] Implémenter la navigation
- [ ] Styliser avec les composants UI

### Après développement
- [ ] Tester sur device physique
- [ ] Vérifier la cohérence avec l'app web
- [ ] Documenter les patterns utilisés
- [ ] Mettre à jour ce guide si nécessaire

---

Ce document doit être votre référence principale pour comprendre et développer l'application mobile House. L'objectif est de créer une expérience mobile qui soit parfaitement cohérente avec l'application Next.js tout en tirant parti de la réutilisabilité du code via le package `shared/`.