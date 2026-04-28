# Module — photos

> Audit : 2026-04-27. Rôle : namespace UI pour visualiser les documents de type photo (les médias passent par `documents`).

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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.
- _aucun item identifié_

## À faire (backlog)

> Features identifiées non encore commencées.
- [ ] Séparer Documents et Photos en deux types distincts avec leurs propres vues et logiques de traitement — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-09 · `docs/TODO.md` ligne 1*

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] Skeleton du grid utilise `bg-slate-100` (couleur hardcodée) — devrait être `bg-muted` — *source : `ui/src/features/photos/PhotosPage.tsx:82`*
- [ ] Bandeau d'erreur utilise `border-red-200 bg-red-50 text-red-700` (couleurs hardcodées) — devrait passer aux tokens `border-destructive/30 bg-destructive/10 text-destructive` — *source : `ui/src/features/photos/PhotosPage.tsx:53`*
- [ ] `usePhotos` consomme `fetchPhotoDocuments` depuis `@/lib/api/documents` mais un fichier `ui/src/lib/api/photos.ts` séparé existe avec `fetchPhotos` — risque de duplication, à clarifier — *source : `ui/src/features/photos/hooks.ts:2` + `ui/src/lib/api/photos.ts`*
- [ ] La page utilise un `ConfirmDialog` (pattern legacy) au lieu de `useDeleteWithUndo` qui est le standard projet — *source : `ui/src/features/photos/PhotosPage.tsx:104` vs `CLAUDE.md` "Suppression — toujours avec undo"*

## Notes

- **Pas de modèle propre** : `photos` est uniquement un namespace UI, le stockage et l'API passent par l'app `documents` — *source : `apps/photos/` ne contient ni `models.py` ni `views.py` ni `urls.py`*
- Templates legacy présents dans `apps/photos/templates/photos/app/` — vestiges du SSR avant migration SPA
- Le filtrage côté serveur se fait par le paramètre `type=photo` sur l'endpoint documents
