Contexte projet — House (Next.js + Supabase)

🎯 Objectif
- Centraliser la mémoire du foyer : interactions chronologiques, fichiers joints, zones hiérarchiques.
- Offrir un périmètre MVP solide (multi-foyers, pièces jointes, stats de zones) en attendant les phases OCR, enrichissement et recherche plein texte.

🧱 Architecture
- Front : Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui.
- Backend : Supabase (Postgres 17) avec RLS systématique, bucket `files` privé.
- Multi-tenant : appartenance via `household_members`, toutes les requêtes filtrées par `household_id`.
- i18n custom (`I18nProvider`) avec dictionnaires `en/fr`, persistance dans `localStorage`.

✅ Fonctionnalités livrées
- Création/gestion de foyers via l'API `create_household_with_owner` (RPC SEC DEF, exécuté depuis le client SSR).
- Dashboard `/app` : sélecteur de foyer, indicateurs (interactions, zones) et raccourcis vers interactions, zones, paramètres et foyers.
- Interactions `/app/interactions` : liste des interactions récentes avec compteurs de documents, métadonnées (type, statut, date), création via RPC `create_interaction_with_zones`, détail avec prévisualisation (image/PDF) et suppression par n'importe quel membre du foyer. Les documents ne peuvent être supprimés dans l'UI que par l'uploader (aligné avec la policy storage « owner-only »).
- Zones `/app/zones` : hiérarchie parent/enfants, notes libres, surface numeric (>= 0), statistiques globales et suppression accessible à tous les membres du foyer.
- Paramètres utilisateur `/app/user-settings` : changement de langue, visualisation de l'ID/email, mise à jour du mot de passe et gestion MFA TOTP (`MFASetup`).
- Authentification : flux login/registration template, rappel `/auth/callback`, écran `/auth/2fa` avec composant `MFAVerification` pour compléter le challenge TOTP.
- Démonstrations héritées (`/app/storage`, `/app/table`) encore présentes pour le moment.

🗃️ Modèle de données (schéma `public`)
- `households`: id, name, created_at. RLS : sélection limitée aux membres, insertion ouverte aux utilisateurs authentifiés.
- `household_members`: (household_id, user_id, role). RLS : un membre peut lire/insérer sa propre ligne.
- `zones`: id, household_id, name, parent_id, note, surface >= 0, created_at, created_by (trigger `trg_zones_set_created_by`). RLS : tout membre peut lire/insérer/mettre à jour/supprimer une zone de son foyer.
- `interactions`: id, household_id, subject, content, type, status nullable, occurred_at, tags[], contact_id nullable, structure_id nullable, metadata jsonb, enriched_text, created_at, updated_at, created_by, updated_by (trigger `update_interaction_metadata`). RLS : tout membre peut lire/insérer/mettre à jour/supprimer les interactions du foyer.
- `interaction_zones`: table de jointure (interaction_id, zone_id) avec cascade, triggers évitant qu’une interaction perde son dernier lien zone.
- `documents`: id, interaction_id, file_path, name, notes, mime_type, type, metadata, ocr_text, created_at, created_by. RLS alignée sur le foyer via `interactions`. Storage : clés au format `userId/interactionId/<uuid>_filename`.
- Héritage template : table `todo_list` (utilisée par `/app/table`).

⚙️ Supabase & scripts
- RPC `create_interaction_with_zones(p_household_id, p_subject, p_content, p_type, p_status, p_occurred_at, p_zone_ids uuid[], p_tags text[], p_contact_id uuid, p_structure_id uuid)` pour créer une interaction + lier les zones atomiquement.
- RPC `create_household_with_owner(p_name text)` (SECURITY DEFINER) pour créer un foyer et inscrire le créateur en owner.
- Scripts racine `package.json` :
  - `yarn dev|build|start` → `cd nextjs && yarn ...`
  - `yarn db:migrate` (`supabase migrations up --linked`)
  - `yarn db:reset`, `yarn db:new <name>`
  - `yarn test:e2e`
- Tests : Playwright (`nextjs/tests/e2e`) couvrant auth, zones (création/édition/suppression, surface/note), interactions (création avec documents, suppression croisée, validations) et gestion des fichiers.

📁 Routes clés
- Dashboard : `nextjs/src/app/app/page.tsx`
- Interactions : `.../interactions/page.tsx`, `.../interactions/new/page.tsx`, `.../interactions/[id]/page.tsx`
- Zones : `.../zones/page.tsx`
- Paramètres & MFA : `.../user-settings/page.tsx`, `src/components/MFASetup.tsx`, `src/components/MFAVerification.tsx`
- API : `src/app/api/households/route.ts`, `src/app/api/internal/process-entry-files/route.ts`
- Contexte global : `src/lib/context/GlobalContext.tsx`

🧪 Exécution locale
1. Supabase : `npx supabase login`, `npx supabase link`, `npx supabase config push`, `npx supabase migrations up --linked`.
2. Front : `cd nextjs && yarn`, copier `.env.template` → `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_KEY`, puis `yarn dev`.
3. Playwright : `cd nextjs && yarn playwright:install`, ensuite `yarn test:e2e` (depuis la racine ou `nextjs/`).

🚧 Prochaines étapes
- Recherche plein texte (`search_vector`, UI `/search`).
- Pipeline OCR/enrichissement : ajout du support image (véritable OCR), planification automatique et enrichissement plus contextuel.
- Edition complète des interactions (texte, zones, pièces jointes) + pagination.
- Gestion avancée des foyers (liste, invitations, rôles, foyer par défaut).
- Nettoyage template : retirer `/app/storage`, `/app/table`, régénérer `src/lib/types.ts`.
- Ajouter CI, tests supplémentaires (unitaires/intégration), documentation produit (`README.md`).
