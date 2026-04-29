# Module — photos

> Audit : 2026-04-28. Rôle : namespace UI pour visualiser les documents de type photo (les médias passent par `documents`).

## État synthétique

- **Backend** : Absent (pas de modèle propre, app Django minimaliste avec uniquement `apps.py` et templates legacy)
- **Frontend** : Complet dans `ui/src/features/photos/` (`PhotosPage`, `PhotoGrid`, `PhotoDetailPanel`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok (namespace `photos` présent dans les 4 locales)
- **Tests** : non
- **Migrations** : 0

## Modèles & API

- Modèles principaux : aucun — l'app `photos` n'a pas de `models.py`, les photos sont des `Document` filtrés par `type='photo'`
- Endpoints exposés : aucun propre — utilise `GET /api/documents/documents/?type=photo&ordering=-created_at` — *source : `ui/src/lib/api/photos.ts:17`*
- Permissions : héritées de `documents` (IsAuthenticated + IsHouseholdMember)

## Notes

- **Pas de modèle propre** : `photos` est uniquement un namespace UI, le stockage et l'API passent par l'app `documents` — *source : `apps/photos/` ne contient ni `models.py` ni `views.py` ni `urls.py`*
- Templates legacy présents dans `apps/photos/templates/photos/app/` — vestiges du SSR avant migration SPA
- Le filtrage côté serveur se fait par le paramètre `type=photo` sur l'endpoint documents
- **Miniatures display-only** (PR #94 / issue #93) : génération de 2 tailles JPEG à l'upload via `apps/documents/thumbnails.py` — `thumb` 400×400 crop pour la grille, `medium` 1200 fit pour le `PhotoDetailPanel`. Stockées à `<dir>/.thumbnails/<size>/<file>.jpg`, exposées via `thumbnail_url` / `medium_url` (fallback `file_url` si absentes). Cleanup auto au `post_delete`. Back-fill via `python manage.py regenerate_photo_thumbnails`. **Ces miniatures ne servent PAS à l'IA** — elles sont uniquement pour l'affichage. La normalisation de l'original pour l'OCR/Vision reste à livrer via #88.
