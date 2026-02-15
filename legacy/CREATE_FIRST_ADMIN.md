# Script SQL pour créer votre premier administrateur

## 1. Connectez-vous à votre Dashboard Supabase
Allez sur https://supabase.com et ouvrez votre projet.

## 2. Trouvez votre User ID
Dans SQL Editor, exécutez :
```sql
-- Connectez-vous d'abord à votre app, puis exécutez ceci
SELECT auth.uid() as your_user_id;
```
Ou pour voir tous les utilisateurs :
```sql
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC;
```

## 3. Créez votre premier Super Admin
Remplacez `YOUR_USER_ID_HERE` par votre ID :
```sql
INSERT INTO public.system_admins (user_id, role, notes)
VALUES ('YOUR_USER_ID_HERE', 'super_admin', 'Premier super administrateur')
ON CONFLICT (user_id) DO NOTHING;
```

## 4. Vérifiez que ça marche
```sql
SELECT sa.*, u.email 
FROM public.system_admins sa
JOIN auth.users u ON u.id = sa.user_id
ORDER BY sa.created_at DESC;
```

## 5. Testez les fonctions
```sql
-- Testez si vous êtes admin (connecté)
SELECT public.is_system_admin();

-- Testez votre rôle
SELECT public.get_user_admin_role();

-- Testez les statistiques
SELECT public.get_system_stats();
```

Une fois fait, reconnectez-vous à votre application et vous devriez voir le lien "Administration" dans la sidebar !