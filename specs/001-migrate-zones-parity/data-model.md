# Data Model — Migration Zones 1:1 Legacy vers Django

## 1) Zone
- **Purpose**: Représente un espace hiérarchique (pièce, étage, bâtiment) dans un household.
- **Core fields**:
  - `id` (UUID)
  - `household_id` (UUID, obligatoire)
  - `name` (string, obligatoire)
  - `parent_id` (UUID, nullable)
  - `note` (text, nullable/blank)
  - `surface` (decimal >= 0, nullable)
  - `color` (hex `#RRGGBB`, valeur par défaut possible)
  - `created_at`, `updated_at`
  - `created_by`, `updated_by`
- **Relationships**:
  - `Zone` 1—N `Zone` (self via `parent_id`)
  - `Zone` N—1 `Household`
  - `Zone` 1—N `ZoneDocument`
- **Validation rules**:
  - `parent_id` doit référencer une zone du même household.
  - `surface` ne peut pas être négative.
  - `color` doit être un hex valide.
  - suppression interdite si la zone possède des enfants.
- **State transitions**:
  - `Created` → `Updated` (édition champs simples)
  - `Updated` → `Reparented` (changement `parent_id`)
  - `Created|Updated|Reparented` → `Deleted` uniquement si `children_count == 0`

## 2) ZoneTreeNode (projection de lecture)
- **Purpose**: Shape hiérarchique pour l'affichage arbre legacy-like.
- **Core fields**:
  - `id`, `name`, `parent_id`
  - `children[]` (récursif)
  - `full_path`, `depth`, `children_count`
  - `color`, `note`, `surface` (normalisés pour UI)
- **Relationships**:
  - Projection issue de `Zone` + relation `children`.
- **Validation rules**:
  - L'arbre doit être acyclique.
  - Tous les nœuds retournés doivent appartenir au household actif.

## 3) ZoneDetailViewData (agrégat page détail)
- **Purpose**: Données d'une page détail zone (infos + stats + galerie).
- **Core fields**:
  - `zone` (snapshot normalisé)
  - `stats` (compteurs simples, ex. nombre d'enfants/photos)
  - `photos[]` (collection de `ZonePhoto`)
- **Relationships**:
  - Agrège `Zone`, descendants directs utiles, et `ZoneDocument(role=photo)`.
- **Validation rules**:
  - La zone détaillée doit être accessible au membre household.

## 4) ZonePhoto (ZoneDocument role=photo)
- **Purpose**: Association d'un document photo à une zone.
- **Core fields**:
  - `zone_id`, `document_id`
  - `role` (`photo`)
  - `note`
  - `created_at`, `created_by`
  - lecture enrichie: `document_name`, `document_file_path`
- **Relationships**:
  - N—1 vers `Zone`
  - N—1 vers `Document`
- **Validation rules**:
  - `document_id` doit exister dans le même household que la zone.
  - unicité du lien `(zone_id, document_id)`.

## 5) ZonesPageInitialPayload (contrat SSR)
- **Purpose**: Payload injecté par Django pour hydratation initiale mini-SPA.
- **Core fields**:
  - `householdId`
  - `initialZones[]` (liste minimale pour rendu initial)
- **Validation rules**:
  - `initialZones` limité à des zones accessibles utilisateur/household actif.
  - cohérence de format entre SSR payload et adaptateur front.

## 6) Concurrency Metadata (contrat de mutation)
- **Purpose**: Prévenir l'écrasement silencieux des updates concurrentes.
- **Core fields**:
  - `last_known_updated_at` (timestamp fourni par client lors update)
- **Validation rules**:
  - si timestamp client != état courant serveur: rejeter la mutation avec erreur de conflit et inviter au rechargement.
