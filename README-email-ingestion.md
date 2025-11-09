# README — Import automatique des devis reçus par email

## 1. Contexte et douleur utilisateur
- Scénario terrain : un membre reçoit un devis par email (PDF ou photos) et veut l’archiver dans House pour suivre les projets. Aujourd’hui il doit ouvrir le dashboard, cliquer sur “Nouvel enregistrement”, remplir le formulaire puis sauvegarder les pièces jointes localement avant de pouvoir les téléverser.
- Le parcours `Nouvel enregistrement` est géré par `nextjs/src/app/app/(pages)/interactions/new/page.tsx:3` qui affiche `InteractionTypeSelector`. Ce dernier ouvre ensuite `InteractionForm` (voir `nextjs/src/features/interactions/components/InteractionForm.tsx:365`) pour saisir toutes les métadonnées.
- Les pièces jointes ne peuvent provenir que du device de l’utilisateur (`DocumentImportButtons`, `nextjs/src/features/interactions/components/DocumentImportButtons.tsx:25`, n’expose que deux `<input type="file">`), ou d’un document déjà téléversé manuellement via la bibliothèque (`ExistingDocumentsModal`, `nextjs/src/features/interactions/components/ExistingDocumentsModal.tsx:70`).
- Même dans la vue détail d’une interaction, l’import (`InteractionAttachmentImport`, `nextjs/src/features/interactions/components/InteractionAttachmentImport.tsx:38-144`) repose sur la même mécanique : re-upload depuis le disque ou sélection d’un document déjà présent.
- Résultat : enregistrer un devis reçu par email impose plusieurs context switches (ouvrir le mail, télécharger chaque pièce jointe, rouvrir House, importer). L’étape de téléchargement est une pure friction et décourage l’adoption pour des artisans qui envoient tout par mail.

## 2. Analyse du flux actuel (côté code)
1. **Création d’une interaction** — `InteractionForm` fait appel au RPC `create_interaction_with_zones` puis, pour chaque fichier sélectionné, compresse, stocke dans le bucket `files` et insère dans `documents` (`nextjs/src/features/interactions/components/InteractionForm.tsx:376-444`). Les métadonnées se limitent au nom du fichier, au type et à `uploadSource`.
2. **Liens documentaires** — La jointure `interaction_documents` (définie dans `supabase/migrations/20251201120000_interaction_documents_m2m.sql:27-208`) impose qu’un document appartienne au même `household_id`, mais ne conserve aucune provenance (email, upload manuel, scan, etc.).
3. **Bibliothèque locale** — Pour réutiliser un document, l’utilisateur doit l’avoir importé auparavant. `ExistingDocumentsModal` ne filtre que sur le `household_id` et limite la liste à 100 derniers fichiers (`nextjs/src/features/interactions/components/ExistingDocumentsModal.tsx:90-132`). Impossible donc de “tirer” directement un PDF resté dans Gmail/Outlook.

Ces éléments montrent que toute la chaîne backend sait déjà gérer des documents multi-sources (cf. `metadata.uploadSource` dans `documents`), mais qu’aucune source automatisée n’alimente la table sans passer par le navigateur.

## 3. Expérience cible : “Boîte de réception devis”
### 3.1 Résumé UX
1. Chaque foyer dispose d’une adresse email dédiée (ex. `maison-<slug>@ingest.house.app`). L’utilisateur transfère ou met en copie (`CC`) les emails contenant un devis.
2. L’email et ses pièces jointes sont capturés automatiquement : création d’un brouillon d’interaction type `quote`, statut `pending`, zones et projets non renseignés.
3. Dans House :
   - Une carte “Boîte de réception devis” apparaît en haut de `/app/interactions/new` (à côté des raccourcis existants) avec le compteur de brouillons.
   - Depuis la liste `/app/interactions`, un nouveau filtre “À qualifier (emails)” affiche ces brouillons.
   - Ouvrir le brouillon préremplit sujet, contenu (body de l’email nettoyé), contact présumé (adresse expéditeur → `structures`/`contacts` existants) et attache automatiquement les pièces jointes.
4. L’utilisateur n’a plus qu’à compléter les zones, un projet et la valeur du devis, puis à sauvegarder.

### 3.2 Détails UI
- **CTA d’import** — Ajouter un troisième bouton “Depuis ma boîte mail” dans `DocumentImportButtons` (après le bouton fichiers) qui ouvre la liste des devis ingérés mais non associés. On réutilise l’infra du modal (`ExistingDocumentsModal`) en filtrant `documents.metadata.uploadSource === 'email_ingest'`.
- **Nouvelle section dans `InteractionTypeSelector`** — Une tuile “Convertir un devis reçu par email” qui navigue vers `/app/interactions/email-inbox` (nouvelle page client). Le composant actuel est léger; la tuile peut se brancher directement dans `InteractionTypeSelector` sans alourdir `page.tsx`.
- **Badge dans la liste** — Dans `InteractionList` (voire `InteractionItem`), afficher un badge “Reçu par email” basé sur `interaction.metadata.origin`.

## 4. Architecture technique proposée
### 4.1 Pipeline d’ingestion email
1. **Adresse par foyer** — Ajouter `inbound_email_alias text unique` sur `households`. Un Cron job génère l’alias si absent.
2. **Fournisseur inbound** — Utiliser Resend, Postmark ou AWS SES (mode inbound) pour recevoir les emails et envoyer un webhook signé vers Supabase Edge Functions.
3. **Edge Function `handle_inbound_quote`**  
   - Exécutée avec la `service_role`.  
   - Valide le `X-Household-Alias` ou parse l’adresse destinataire pour retrouver `household_id`.  
   - Stocke l’email brut dans un bucket `incoming-emails` (S3 compatible) pour audits.
   - Dépose un job dans la table `incoming_email_jobs`.
4. **Worker (Supabase cron / queue)**  
   - Parse le MIME, extrait texte et pièces jointes.  
   - Stocke chaque fichier dans `storage.files` en respectant le schéma actuel (`system/<household>/<mailId>/<filename>`).  
   - Crée les lignes `documents` avec `metadata` enrichie (`uploadSource: "email_ingest"`, `email.from`, `email.subject`, `email.messageId`).  
   - Crée une interaction brouillon (`interactions.type = 'quote'`, `status = 'pending'`, `metadata.origin = 'email_ingest'`) et lie les documents via `interaction_documents`.

### 4.2 Modèle de données
- `incoming_emails` (nouvelle table)  
  ```
  id uuid pk
  household_id uuid
  message_id text unique
  from_email text
  subject text
  body_html text
  body_text text
  received_at timestamptz default now()
  processing_status email_status default 'pending'
  error_reason text
  metadata jsonb
  ```
  RLS calquée sur `interactions` (membres du foyer).
- `incoming_email_attachments` (table enfant) pour garder la trace de toutes les pièces même si certaines ne sont pas converties.
- Ajout d’un index partiel sur `documents(metadata->>'uploadSource')` pour charger rapidement les fichiers venant des emails.

### 4.3 Backend & API
- Nouvelle route API sécurisée `/api/internal/email-inbox/:id/claim` (server actions) permettant de marquer un brouillon comme “traité” quand un membre convertit l’email.
- Mise à jour du RPC `create_interaction_with_zones` pour accepter un paramètre optionnel `p_incoming_email_id` et marquer l’email comme `processed`, afin d’assurer l’atomicité.

### 4.4 Frontend
1. **Hooks** — Ajouter `useIncomingEmails` dans `nextjs/src/features/interactions/hooks/` pour récupérer la liste paginée (limite 20) des brouillons.
2. **Pages** — Nouvelle route `nextjs/src/app/app/(pages)/interactions/email-inbox/page.tsx` côté client (utilise `use client`) avec la liste, un preview du corps et les boutons “Associer à une interaction” / “Ignorer”.
3. **Formulaire** — Étendre `InteractionForm` pour accepter `prefill` (subject/content/documents) et empêcher le double upload si `documents` déjà associés via `incoming_email_id`.

## 5. Plan de livraison incrémental
1. **Phase 1 — Ingestion silencieuse**  
   - Créer la base de données (`incoming_emails`, alias par foyer) et l’edge function.  
   - Injecter automatiquement les interactions brouillon + documents, sans UI dédiée (visible uniquement dans la table).  
   - Ajouter une page admin cachée pour vérifier les emails reçus.
2. **Phase 2 — UI d’examen**  
   - Ajouter la page `/interactions/email-inbox` et la tuile “Boîte de réception” dans `InteractionTypeSelector`.  
   - Permettre de convertir un brouillon en interaction complète (réutilise `InteractionForm` avec des valeurs par défaut).
3. **Phase 3 — Finition**  
   - Bouton “Depuis ma boîte mail” dans `DocumentImportButtons`.  
   - Badges et filtres dans `InteractionList`.  
   - Notifications (toast) quand un email est ingéré pour le foyer sélectionné.

Chaque phase reste déployable individuellement tout en réduisant immédiatement la friction : dès la phase 1, l’utilisateur n’a plus besoin de télécharger les pièces jointes manuellement.

## 6. Questions ouvertes & risques
1. **Sécurité / spoofing** — Comment empêcher qu’un tiers envoie un email arbitraire vers l’alias ? Proposition : n’accepter que les expéditeurs présents dans `contacts` ou imposer un jeton secret (`alias+code@`).  
2. **Quota stockage** — Les devis peuvent contenir des dizaines de pages. Faut-il compresser côté worker comme le fait déjà `compressFileForUpload` dans le navigateur (`nextjs/src/features/interactions/components/InteractionForm.tsx:397-414`) ?  
3. **Matching contacts** — On peut tenter de rapprocher `from_email` d’une `structure` existante, mais il faudra prévoir une UI pour confirmer/éditer.  
4. **RGPD** — Conserver le corps complet de l’email implique d’afficher un bandeau d’information aux utilisateurs finaux. Ajouter une section dédiée dans `instructions.md`.  
5. **Internationalisation** — Les textes “Boîte de réception devis”, “Reçu par email”, etc., doivent être ajoutés aux dictionnaires `nextjs/src/lib/i18n/dictionaries/en.json` et `fr.json`.

---

En automatisant la capture des pièces jointes au moment où elles arrivent par email, on s’appuie sur les briques existantes (documents + interaction_documents + metadata) tout en supprimant l’étape la plus pénible pour les utilisateurs : télécharger localement un fichier qu’ils vont immédiatement ré-uploader.
