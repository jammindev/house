Contexte projet — Carnet de Maison (Next.js + Supabase)

Objectif
- Centraliser les infos de la maison dans un journal d’entrées avec pièces jointes, zones et recherche.
- MVP : création d’entrées, upload multi-documents (PDF/JPG/PNG), OCR basique, recherche plein texte + filtres.
- Phase 2 : projets de rénovation, dashboard budget, rappels & maintenance.

Stack
- UI : Next.js (template Razikus supabase-nextjs-template).
- Backend/Auth/DB/Storage : Supabase.
- OCR : fonction Edge (Tesseract) ou job server-side simple → texte indexable.

Données (MVP)
- `zones` : id, name, created_by, created_at. (L’utilisateur peut créer ses zones via l’UI.)
- `entries` :
  - id (uuid), type(text: expense|invoice|renovation|maintenance|meter_reading|income|document|contact), date, title,
    amount?, currency default 'EUR', notes?, zone_id (nullable FK → zones.id), payload(jsonb), created_by, created_at.
- `entry_files` (N:1 avec entries) :
  - id, entry_id(FK), bucket, path, filename, size, mime_type, ocr_text(text), created_by, created_at.
- `tags` / `entry_tag` (optionnel MVP si tu veux déjà filtrer par tag) :
  - tags(id, name, created_by), entry_tag(entry_id, tag_id).
- Index & recherche :
  - Colonne matérialisée `search_vector` (tsvector) sur `entries` alimentée par (title, notes, payload::text, concat OCR des fichiers liés).
  - GIN index sur `search_vector`.

Sécurité (RLS)
- RLS actif sur toutes les tables.
- Règle : chaque utilisateur ne voit/modifie que ses lignes (`created_by = auth.uid()`).
- Storage bucket `documents` privé. Les URLs signées sont générées côté serveur (route Next/server action).

MVP — Fonctionnalités
1) **Entrées**
   - Créer/voir/lister des `entries` (type, date, titre, montant?, currency?, notes?, zone sélectionnable, payload JSON libre).
   - Choisir une zone existante ou en créer une nouvelle depuis le formulaire (inline create).
2) **Pièces jointes**
   - Upload multiple PDF/JPG/PNG → Supabase Storage (`documents/…`).
   - Pour chaque fichier, créer une ligne `entry_files`.
   - Pipeline OCR : à l’upload, déclencher OCR (Edge Function) → stocker `ocr_text` sur `entry_files`.
3) **Recherche & filtres**
   - Recherche plein texte (barre de recherche) sur `search_vector`.
   - Filtres combinables : type, tags (si activé), période (date_from/date_to), zone, projet (placeholder: null en MVP).
4) **Pages**
   - `/entries` : liste (chips de filtres + recherche).
   - `/entries/new` : formulaire + création zone inline + section “Pièces jointes (multi)”.
   - `/entries/[id]` : détail + liste des documents (download/delete).

Schéma — DDL (résumé)
- `zones(id uuid pk, name text not null, created_by uuid fk auth.users, created_at timestamptz default now())`
- `entries(id uuid pk, type text not null, date date not null, title text not null,
           amount numeric, currency text default 'EUR', notes text, zone_id uuid fk zones,
           payload jsonb, created_by uuid fk auth.users, created_at timestamptz default now(),
           search_vector tsvector)`
- `entry_files(id uuid pk, entry_id uuid fk entries on delete cascade,
              bucket text not null, path text not null, filename text, size bigint, mime_type text,
              ocr_text text, created_by uuid fk auth.users, created_at timestamptz default now())`
- (optionnel) `tags(id uuid pk, name text unique, created_by uuid, created_at timestamptz)`
- (optionnel) `entry_tag(entry_id uuid fk, tag_id uuid fk, pk(entry_id, tag_id))`
- Index : `CREATE INDEX entries_search_idx ON entries USING GIN(search_vector);`

Génération `search_vector` (stratégie simple MVP)
- Trigger AFTER INSERT/UPDATE sur `entries` qui concatène :
  - `title`, `notes`, `payload::text`, et l’agrégat `string_agg(entry_files.ocr_text,' ')` (via fonction qui relit les fichiers liés).
- Trigger AFTER INSERT/UPDATE sur `entry_files` pour rafraîchir `entries.search_vector` de la ligne parente.

API / Server actions (MVP)
- `createEntry(data)` → insert `entries`, retourne `id`.
- `createZone(name)` → insert `zones` (UI inline).
- `uploadFiles(files[])` → Storage upload → retourne meta `{bucket, path, filename, size, mime_type}`.
- `attachFiles(entryId, metas[])` → insert `entry_files` (N fichiers).
- `searchEntries({q, type, zone_id, date_from, date_to, tags[]?})`
  - q → `to_tsquery/plainto_tsquery` sur `search_vector`.
- `getEntry(id)` + `listEntryFiles(id)`.

Critères de réussite (MVP)
- Je peux créer une entrée (avec zone choisie/créée).
- Je peux y attacher plusieurs documents.
- L’OCR se lance et le texte devient cherchable.
- La recherche plein texte + filtres renvoie les bonnes entrées.

Phase 2 — Roadmap
- **Projets de rénovation**
  - Table `projects` (id, name, status, budget, start/end, created_by…)
  - Champ `project_id` nullable sur `entries`.
  - Vue projet : tâches, achats, devis/factures, photos avant/après, “budget vs réel”.
- **Tableau de bord budget**
  - Dépenses par catégorie, cumul mensuel, top fournisseurs.
  - Inclure `income` (ex: revenu_loyer) pour un **cashflow net maison**.
- **Rappels & maintenance**
  - Table `maintenance_tasks` (title, cadence, next_due, asset_id?)
  - Rappels : entretiens chaudière, fin de garantie, relevés compteurs.
  - Checklists récurrentes (trimestriel, annuel).

Non-objectifs MVP
- Partage multi-comptes avancé, import bancaire, extraction IA complète, assets/QR (reportés).
