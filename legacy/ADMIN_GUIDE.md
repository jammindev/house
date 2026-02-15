# Administration House - Guide de Configuration et d'Utilisation

## Vue d'ensemble

L'espace administrateur de House permet aux administrateurs système de gérer l'application, surveiller les performances et administrer les utilisateurs et foyers. Ce système utilise un modèle de rôles à deux niveaux :

- **Admin** : Accès aux fonctionnalités de base (utilisateurs, foyers, monitoring)
- **Super Admin** : Accès complet incluant la gestion des autres administrateurs

## Installation et Configuration

### 1. Appliquer la Migration

D'abord, appliquez la migration qui crée les tables et fonctions administrateur :

```bash
cd /path/to/your/project
npx supabase db push
```

Cette migration crée :
- Table `system_admins` avec RLS
- Fonctions helper (`is_system_admin()`, `is_super_admin()`, etc.)
- Fonctions de gestion (`grant_admin_role()`, `revoke_admin_role()`)
- Fonction de statistiques (`get_system_stats()`)

### 2. Créer le Premier Super Admin

Après avoir appliqué la migration, vous devez créer votre premier super administrateur. Connectez-vous à votre base de données et exécutez :

```sql
-- 1. Obtenez votre user_id (connectez-vous d'abord via l'interface web)
SELECT auth.uid(); -- Notez cet ID

-- 2. Insérez-vous comme super admin (remplacez 'YOUR_USER_ID_HERE' par votre ID)
INSERT INTO system_admins (user_id, role, notes)
VALUES ('YOUR_USER_ID_HERE', 'super_admin', 'Premier super administrateur')
ON CONFLICT (user_id) DO NOTHING;
```

Ou via l'interface SQL de Supabase :
1. Allez dans votre dashboard Supabase
2. Section "SQL Editor"
3. Exécutez la requête ci-dessus

### 3. Vérification

Reconnectez-vous à votre application. Vous devriez maintenant voir :
- Un lien "Administration" dans la sidebar (avec l'icône bouclier)
- Accès complet à `/admin` et ses sous-pages

## Architecture du Système Admin

### Structure des Fichiers

```
nextjs/src/
├── features/admin/                 # Module admin isolé
│   ├── components/
│   │   ├── AdminGuard.tsx         # Protection d'accès
│   │   ├── AdminDashboard.tsx     # Dashboard principal
│   │   ├── AdminNav.tsx           # Navigation admin
│   │   ├── UserManagement.tsx     # Gestion utilisateurs
│   │   ├── HouseholdManagement.tsx # Gestion foyers
│   │   ├── AdminManagement.tsx    # Gestion admins
│   │   └── SystemManagement.tsx   # Configuration système
│   ├── hooks/
│   │   └── useAdmin.ts            # Hooks pour permissions
│   ├── lib/                       # Utilitaires admin
│   └── types.ts                   # Types TypeScript
├── app/admin/                      # Routes admin
│   ├── layout.tsx                 # Layout avec navigation
│   ├── page.tsx                   # Dashboard principal
│   ├── users/page.tsx             # Gestion utilisateurs
│   ├── households/page.tsx        # Gestion foyers
│   ├── admins/page.tsx            # Gestion admins
│   ├── database/page.tsx          # Monitoring DB
│   ├── logs/page.tsx              # Logs système
│   └── system/page.tsx            # Configuration
└── components/ui/table.tsx         # Composant table ajouté
```

### Fonctionnalités Disponibles

#### Dashboard Principal (`/admin`)
- Statistiques système en temps réel
- Vue d'ensemble des métriques
- Liens rapides vers les sections
- Monitoring de l'activité récente

#### Gestion des Utilisateurs (`/admin/users`)
- Liste tous les utilisateurs avec leurs statistiques
- Attribution/révocation de rôles admin
- Bannissement d'utilisateurs
- Filtres et recherche

#### Gestion des Foyers (`/admin/households`)
- Vue d'ensemble de tous les foyers
- Statistiques par foyer (membres, contenu, activité)
- Suppression de foyers
- Recherche et filtres

#### Gestion des Administrateurs (`/admin/admins`) - Super Admin uniquement
- Attribution de rôles admin/super_admin
- Révocation de privilèges
- Historique des attributions
- Notes et justifications

#### Monitoring Système (`/admin/system`)
- État des services (DB, stockage, API)
- Métriques de performance
- Outils de maintenance
- Configuration système

#### Base de Données (`/admin/database`)
- État et métriques de la DB
- Outils de sauvegarde
- Optimisation des performances

#### Logs Système (`/admin/logs`)
- Journaux d'activité filtrables
- Niveaux d'erreur
- Recherche et export

## Permissions et Sécurité

### Modèle de Permissions

1. **Utilisateur Normal** : Accès uniquement aux foyers dont il est membre
2. **Admin** : Accès à toutes les fonctionnalités admin sauf gestion des admins
3. **Super Admin** : Accès complet, peut gérer d'autres admins

### Protection des Routes

Toutes les routes admin sont protégées par `AdminGuard` :
```tsx
<AdminGuard requireSuperAdmin={boolean}>
  {/* Contenu protégé */}
</AdminGuard>
```

### Fonctions de Base de Données

Les fonctions SQL sont sécurisées avec `SECURITY DEFINER` et vérifient :
- L'authentification de l'utilisateur (`auth.uid()`)
- Les permissions appropriées via `system_admins`

## Utilisation

### Pour les Administrateurs

1. **Accès** : Lien "Administration" dans la sidebar
2. **Dashboard** : Vue d'ensemble système et navigation
3. **Utilisateurs** : Gérer comptes et permissions
4. **Foyers** : Surveiller et administrer les foyers
5. **Monitoring** : Surveiller performance et santé système

### Pour les Super Administrateurs

En plus des fonctionnalités admin :
1. **Gestion des Admins** : Nommer/révoquer des administrateurs
2. **Configuration Système** : Paramètres avancés
3. **Accès Complet** : Toutes les fonctionnalités disponibles

### Attribution d'un Rôle Admin

Via l'interface (`/admin/admins`) :
1. Cliquer "Ajouter un admin"
2. Saisir l'email de l'utilisateur
3. Choisir le rôle (admin/super_admin)
4. Ajouter des notes justificatives
5. Confirmer l'attribution

Via SQL (pour les super admins) :
```sql
SELECT grant_admin_role(
  'user-uuid-here',
  'admin', -- ou 'super_admin'
  'Notes explicatives'
);
```

## Développement et Extension

### Ajouter une Nouvelle Fonctionnalité Admin

1. **Créer le composant** dans `features/admin/components/`
2. **Ajouter la route** dans `app/admin/nouvelle-fonctionnalite/page.tsx`
3. **Mettre à jour la navigation** dans `AdminNav.tsx`
4. **Ajouter la protection** avec `AdminGuard` si nécessaire

### Ajouter des Statistiques

1. **Étendre `SystemStats`** dans `types.ts`
2. **Modifier `get_system_stats()`** dans la migration SQL
3. **Mettre à jour `AdminDashboard`** pour afficher les nouvelles données

### Tests et Validation

Avant de déployer :
1. Tester toutes les permissions (user/admin/super_admin)
2. Vérifier les protections RLS
3. Valider les fonctions SQL
4. Tester la navigation et l'interface

## Notes Importantes

### Limitations Actuelles

1. **Données Mock** : Certaines fonctionnalités utilisent des données simulées en attendant l'accès service-role
2. **Logs Avancés** : Le monitoring complet sera implémenté dans une version future
3. **Types non Générés** : Les nouveaux types SQL ne sont pas encore dans `types.ts`

### Prochaines Étapes

1. Implémenter l'accès service-role pour les vraies données
2. Ajouter le monitoring avancé et alertes
3. Étendre les fonctionnalités de maintenance
4. Ajouter l'audit trail pour les actions admin

### Sécurité

- Ne jamais exposer de clés service-role côté client
- Toujours valider les permissions côté serveur
- Logger toutes les actions administratives
- Utiliser des confirmations pour les actions destructives

---

## Support

Pour toute question sur l'administration de House, consultez la documentation technique dans `AGENTS.md` ou les migrations dans `supabase/migrations/`.