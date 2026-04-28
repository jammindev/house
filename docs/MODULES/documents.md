# Module — documents

> Audit : 2026-04-27. Rôle : fichiers attachés (factures, manuels, photos, etc.) reliés au contexte métier (parcours 02).

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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] OCR jamais déclenché : l'action `reprocess_ocr` retourne `202 Accepted` mais ne queue rien (`# TODO: Queue OCR task`) — *source : `apps/documents/views.py:242` ; `GITHUB_ISSUES_BACKLOG.md` FEAT-06*
- [ ] Doublon legacy : `apps/documents/tests.py` coexiste avec `apps/documents/tests/` — uniformiser vers la structure dossier — *source : `GITHUB_ISSUES_BACKLOG.md` REFACTOR-04, `docs/ARCHITECTURE_AUDIT_2026_03.md` lignes 79-90*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Séparer Documents et Photos en deux types distincts (vues + logiques de traitement) — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-09, `docs/TODO.md` ligne 1*
- [ ] OCR automatique à l'upload (queue le traitement après création du document) — *source : `apps/documents/views.py:242` ; `GITHUB_ISSUES_BACKLOG.md` FEAT-06*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Sortir progressivement de `Document.interaction` (FK unique) au profit de `InteractionDocument` (M2M) — la FK reste à titre transitoire mais ne doit plus structurer la page détail ni les filtres — *source : `docs/parcours/PARCOURS_02_BACKLOG_TECHNIQUE.md` lignes 53-58, 235-243*

## Notes

- Upload : `validate_upload` (`core.file_validation`) avec `ALLOWED_DOCUMENT_TYPES` et `DOCUMENT_MAX_SIZE` ; le mime-type est ré-détecté côté serveur, jamais lu depuis le client.
- Path de stockage : `documents/{household_id}/{YYYY}/{MM}/{uuid}-{safe_name}` (`Document.build_upload_path`).
- Filtre `qualification_state=without_activity` (alias `without_activity=1/true/yes`) → documents sans `InteractionDocument` (point d'entrée de tri du parcours 02).
- Détail document : sérialisation enrichie avec `linked_interactions`, `prefetched_zone_documents`, `prefetched_project_documents` + suggestions `recent_interaction_candidates` (5 dernières interactions du household).
- En cas d'échec après `default_storage.save`, le fichier physique est supprimé (`views.py:203-206`) — pas de fichier orphelin sur upload raté.
