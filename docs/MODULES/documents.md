# Module — documents

> Audit : 2026-04-28. Rôle : fichiers attachés (factures, manuels, photos, etc.) reliés au contexte métier (parcours 02).

## État synthétique

- **Backend** : Présent (`Document` + upload multipart + privacy `is_private`)
- **Frontend** : Complet dans `ui/src/features/documents/` (`DocumentsPage`, `DocumentDetailPage`, `DocumentUploadDialog`, `DocumentEditDialog`, `DocumentCard`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `documents` présent dans les 4 fichiers (ligne 693)
- **Tests** : oui — 2 fichiers (`test_api_documents.py`, `test_download_supabase_bucket_files.py`) ; un legacy `apps/documents/tests.py` coexiste avec le dossier `tests/`
- **Migrations** : 4

## Modèles & API

- Modèles principaux : `Document` (HouseholdScopedModel) avec `file_path`, `mime_type`, `type`, `ocr_text`, `is_private`, `metadata` JSONField, FK transitoire `interaction`
- Endpoints exposés sous `/api/documents/` : `documents/` (CRUD + actions `upload` multipart, `by_type`, `reprocess_ocr`)
- Permissions : `IsHouseholdMember` ; visibilité conditionnelle (`is_private=True` → seul `created_by` voit), seul l'uploader peut basculer `is_private` (`views.py:107-114`)

## Notes / décisions produit

- Upload : `validate_upload` (`core.file_validation`) avec `ALLOWED_DOCUMENT_TYPES` et `DOCUMENT_MAX_SIZE` ; le mime-type est ré-détecté côté serveur, jamais lu depuis le client.
- Path de stockage : `documents/{household_id}/{YYYY}/{MM}/{uuid}-{safe_name}` (`Document.build_upload_path`).
- Filtre `qualification_state=without_activity` (alias `without_activity=1/true/yes`) → documents sans `InteractionDocument` (point d'entrée de tri du parcours 02).
- Détail document : sérialisation enrichie avec `linked_interactions`, `prefetched_zone_documents`, `prefetched_project_documents` + suggestions `recent_interaction_candidates` (5 dernières interactions du household).
- En cas d'échec après `default_storage.save`, le fichier physique est supprimé (`views.py:203-206`) — pas de fichier orphelin sur upload raté.
- **Pipeline miniatures photos** (PR #94 / issue #93) : pour les documents `type='photo'`, génération synchrone de 2 thumbnails JPEG à l'upload via `apps/documents/thumbnails.py` (Pillow direct, pas de dep ajoutée) — `thumb` 400×400 crop, `medium` 1200 fit. Stockage dans un sous-dossier `.thumbnails/<size>/` à côté de l'original. Sérialisé via `thumbnail_url` / `medium_url`. Cleanup au `post_delete`. Management command `regenerate_photo_thumbnails` pour back-fill (flags `--force`, `--household`). À distinguer de la normalisation de l'original prévue dans #88 (HEIC→JPEG, resize >2000px) qui, elle, modifie le fichier source pour alimenter l'OCR/Vision IA.
