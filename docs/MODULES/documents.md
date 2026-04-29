# Module — documents

> Audit : 2026-04-29. Rôle : fichiers attachés (factures, manuels, photos, etc.) reliés au contexte métier (parcours 02 — traiter un document entrant).

## État synthétique

- **Backend** : Présent et complet. Modèle `Document`, pipeline OCR (Vision + pypdf), thumbnails photos, privacy `is_private`, signals cleanup storage.
- **Frontend** : Complet dans `ui/src/features/documents/` (`DocumentsPage`, `DocumentDetailPage`, `DocumentUploadDialog`, `DocumentEditDialog`, `DocumentCard`, `hooks.ts`). Route câblée dans `router.tsx:60-61`.
- **Locales (en/fr/de/es)** : ok — namespace `documents` présent dans les 4 fichiers avec toutes les clés utilisées.
- **Tests** : 6 fichiers pytest (`test_api_documents.py`, `test_extraction.py`, `test_thumbnails.py`, `test_image_processing.py`, `test_extract_documents_text_command.py`, `test_download_supabase_bucket_files.py`). **3 tests en échec** (divergence tests/code). 0 couverture E2E Playwright.
- **Migrations** : 4 (initiale → `interaction_document` index → `alter_options` → `avatar_upload_path + is_private`).
- **Couverture parcours métier** : parcours 02 (document entrant → activité), parcours 03 (tâche depuis document), parcours 04 (projets).
- **Issues GH ouvertes** : #80 (multi-upload interactions), #39 (séparation Documents/Photos), #36 (OCR automatique — obsolète, implémenté).

---

## Modèles & API

### Modèle `Document` (`apps/documents/models.py`)

- Hérite de `HouseholdScopedModel` → `household` FK avec `on_delete=CASCADE` (suppression household → cascade sur tous ses documents).
- `created_by` / `updated_by` → `on_delete=SET_NULL` (suppression user → documents conservés, `created_by=null`).
- `file_path` : `CharField(500)` — chemin de stockage custom, pas de `FileField` Django. Pattern : `documents/{household_id}/{YYYY}/{MM}/{uuid}-{safe_name}`.
- `type` : choix parmi `photo`, `document`, `invoice`, `manual`, `warranty`, `receipt`, `plan`, `certificate`, `other`.
- `ocr_text` : texte extrait (vide si photo ou extraction échouée).
- `metadata` : JSONField libre — contient `size`, `ocr_method`, `ocr_extracted_at`, `normalized`, `resized`, `dimensions`.
- `is_private` : boolean — filtre appliqué dans le queryset (seul `created_by` voit ses propres privés).
- `interaction` : FK nullable vers `Interaction` (`on_delete=CASCADE`). FK "legacy" conservée par rétro-compat. La relation principale passe désormais par `InteractionDocument` (M2M).
- **Pas de soft-delete** — suppression physique + cascade complète.
- Index : `idx_docs_hh_type` (household+type), `idx_docs_interaction` (interaction), `idx_docs_creator` (created_by).

### Tables de liaison (autres apps)

| Liaison | FK Document `on_delete` | Comportement si document supprimé |
|---|---|---|
| `InteractionDocument` (`interactions/models.py:223`) | `CASCADE` | Lien supprimé |
| `ZoneDocument` (`zones/models.py:132`) | `CASCADE` | Lien supprimé |
| `ProjectDocument` (`projects/models.py`) | `CASCADE` | Lien supprimé |
| `TaskDocument` (`tasks/models.py`) | `CASCADE` | Lien supprimé |

> Comportement correct : supprimer un document nettoie tous ses liens sans laisser d'orphelins dans les tables de liaison. Les entités parentes (zone, interaction, task, project) survivent.

### Endpoints (`/api/documents/`)

| Méthode | URL | Action |
|---|---|---|
| GET | `documents/` | Liste filtrée (type, interaction, search, zone, project, qualification_state) |
| POST | `documents/` | Création sans upload (file_path manuel) |
| GET | `documents/{id}/` | Détail enrichi (linked_interactions, zone_links, project_links, recent candidates) |
| PATCH/PUT | `documents/{id}/` | Mise à jour (nom, notes, type, is_private) |
| DELETE | `documents/{id}/` | Suppression (déclenche signal → fichier physique + thumbnails) |
| POST | `documents/upload/` | Upload multipart (magic bytes, normalization, OCR) |
| GET | `documents/by_type/` | Comptage par type |
| POST | `documents/{id}/reprocess_ocr/` | Relancer l'extraction OCR |

Permissions : `IsHouseholdMember` partout. Seul le `created_by` peut changer `is_private` (`views.py:140-144`).

### Pipeline OCR / extraction (`apps/documents/extraction.py`)

- Images (JPEG, PNG, WebP, GIF) → Claude Haiku 4.5 Vision (base64).
- PDF → pypdf (text-based uniquement — PDFs scannés renvoient `pypdf_empty`).
- Fail-soft : tout échec → `("", "skipped")`. Le doc est toujours créé et utilisable.
- Méthodes retournées : `vision_haiku`, `vision_empty`, `pypdf`, `pypdf_empty`, `skipped`.
- HEIC/HEIF → normalisé en JPEG avant extraction (`image_processing.py`), resize si > 2000px.
- Photos (`type='photo'`) : pipeline thumbnails (Pillow) à la place de l'OCR (`views.py:274-277`).

### Sécurité fichiers (`apps/core/views_media.py`, `apps/core/file_validation.py`)

- Upload : magic bytes validés côté serveur via `validate_upload()` — le `Content-Type` client est ignoré (`file_validation.py:65-73`).
- Taille max : 20 MB (`DOCUMENT_MAX_SIZE`).
- Accès media : `serve_protected_media` vérifie l'appartenance au household avant de servir. En prod : `X-Accel-Redirect` → Nginx. Privacy : 403 si `is_private=True` et non-uploader (`views_media.py:41-43`).
- Pas d'URL signée / temporaire — accès direct via `/media/{file_path}` protégé par le middleware Django.
- Path traversal : `get_valid_filename()` à la construction du chemin (`models.py:92`) et extraction de `Path(filename).name` (pas de sous-dossiers depuis le client).

### Cleanup intégrité

- Signal `post_delete` sur `Document` → supprime le fichier physique + les thumbnails (`signals.py:9-21`). Couvre aussi les QuerySet.delete() bulks (post_delete est bien déclenché par Django pour les M2M cascade).
- Si la création DB échoue après `default_storage.save`, le fichier physique est supprimé dans le `except` (`views.py:269-272`).
- Pas de commande de cleanup pour fichiers orphelins sur le storage (fichiers sans `Document` en base).

### Commandes de gestion

- `extract_documents_text` : backfill OCR sur documents existants. Options : `--household`, `--force`, `--type`, `--limit`, `--include-photos`, `--dry-run`.
- `regenerate_photo_thumbnails` : backfill thumbnails.
- `download_supabase_bucket_files` : migration legacy depuis Supabase storage.

---

## Notes / décisions produit

- **Architecture "double relation" interaction → document** : la FK `Document.interaction` est une relation legacy (migration Supabase). Le vrai lien M2M est `InteractionDocument`. Les deux coexistent — `legacy_interaction` est exposé dans le sérialiseur pour ne pas casser les clients. Ne pas supprimer la FK sans migration de données (`apps/documents/models.py:69-76`).
- **Photos vs Documents** : `type='photo'` a une logique d'affichage séparée côté frontend (`fetchDocuments` filtre les photos, `fetchPhotoDocuments` les isole — `lib/api/documents.ts:92`). La séparation complète en deux modules distincts est en cours de réflexion (issue #39, label `idea`).
- **OCR synchrone** : l'extraction tourne dans le thread de la requête HTTP d'upload. Sur un PDF lourd ou une image haute résolution, cela peut allonger la réponse. Pas de queue (Celery, etc.) actuellement — décision assumée de garder simple en phase solo.
- **Pas de pagination** : `DocumentViewSet` n'a pas de `pagination_class`. La liste complète est chargée d'un coup. À surveiller dès que le nombre de documents croît (pas de `PAGE_SIZE` dans `REST_FRAMEWORK` settings non plus — `config/settings/base.py:145`).
- **Lien au module agent/RAG** : `apps/agent/` n'existe pas encore. Le champ `Interaction.enriched_text` (`interactions/models.py:78`) est prévu pour un futur pipeline qui consolidera le texte OCR des documents. Les documents ne sont pas encore indexés dans un moteur de recherche vectoriel.
- **Upload multipart via action custom** : l'endpoint `POST /upload/` est une action custom séparée du `POST documents/` classique. Le `POST documents/` accepte un `file_path` manuel (cas import legacy). Les deux coexistent — ne pas confondre dans les tests ou le client.
- Parcours 02 cadré dans `docs/parcours/PARCOURS_02_TRAITER_UN_DOCUMENT_ENTRANT_ET_LE_RELIER_AU_BON_CONTEXTE.md` et `PARCOURS_02_BACKLOG_TECHNIQUE.md`.

---

## Violations CLAUDE.md identifiées (code en place)

- `defaultValue` interdit dans `t()` — 3 occurrences actives :
  - `DocumentsPage.tsx:73` : `t(\`documents.type.${v}\`, { defaultValue: v })`
  - `DocumentCard.tsx:52` : `t(\`documents.type.${doc.type}\`, { defaultValue: doc.type })`
  - `DocumentEditDialog.tsx:61` : `t(\`documents.type.${v}\`, { defaultValue: v })`
- Couleur hardcodée dans le skeleton du `DocumentsPage.tsx:143` : `bg-slate-100` → devrait être `bg-muted`.
- Couleurs hardcodées dans `DocumentCard.tsx` :
  - `text-blue-500 dark:text-blue-400` (icône fichier, ligne 34) — pas de token équivalent dans le design system, mais à aligner.
  - `border-amber-200 bg-amber-50 text-amber-700` (badge "sans contexte", ligne 76) — à passer en token ou composant Badge.
