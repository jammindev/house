# Module — directory

> Audit : 2026-04-27. Rôle : carnet d'adresses partagé du foyer (contacts + structures).

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/directory/`
- **Locales (en/fr/de/es)** : ok (namespace `directory` + `contacts` + `structures` présents)
- **Tests** : oui — 2 fichiers (`test_api_directory.py`, `test_import_supabase_directory_documents.py`)
- **Migrations** : 1 (squash `0005_squashed_contacts_0004_structure.py`)

## Modèles & API

- Modèles principaux : `Structure`, `Contact`, `Address`, `Email`, `Phone` (`apps/directory/models.py`)
- Endpoints exposés :
  - `/api/contacts/contacts/`, `/api/contacts/structures/`, `/api/contacts/addresses/`, `/api/contacts/emails/`, `/api/contacts/phones/` (via `directory.urls`)
  - `/api/structures/` (alias direct via `directory.structures_urls`)
- Permissions : `IsAuthenticated` + `IsHouseholdMember` (`apps/directory/views.py:15`), scoping household systématique via `HouseholdScopedManager`

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.
- _aucun item identifié_

## À faire (backlog)

> Features identifiées non encore commencées.
- [ ] Export vCard — contact unique + export global du foyer (Phase 1 du RFC) — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-07 · `docs/SYNC_CONTACTS_STRUCTURES.md` §8 Phase 1*
- [ ] Import vCard avec preview et détection de doublons (Phase 2 du RFC) — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-08 · `docs/SYNC_CONTACTS_STRUCTURES.md` §8 Phase 2*
- [ ] Ajouter dépendance `vobject==0.9.6.1` à `requirements/base.txt` — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §5.1*
- [ ] Créer `apps/directory/vcard/exporter.py` et `importer.py` — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §5.2*
- [ ] Endpoints export/import : `GET /contacts/export/`, `GET /contacts/{id}/export/`, `POST /contacts/import/preview/`, `POST /contacts/import/` — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §5.5*
- [ ] Action "Exporter en vCard" dans `ContactCard` et `StructureCard` dropdown — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §6.1*
- [ ] Dialog import en 2 étapes (upload + prévisualisation avec résolution ORG) — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §6.2*
- [ ] Export filtré par structure ou tag (priorité basse, futur) — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §3.1*

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] Skeleton utilise `bg-slate-100` (couleur hardcodée), devrait être `bg-muted` — *source : `ui/src/features/directory/DirectoryFeaturePage.tsx:224`*
- [ ] Bandeau d'erreur utilise `border-red-200 bg-red-50 text-red-700` (couleurs hardcodées), devrait passer aux tokens `border-destructive/30 bg-destructive/10 text-destructive` — *source : `ui/src/features/directory/DirectoryFeaturePage.tsx:204`*

## Notes

- L'app Django s'appelle `directory` mais le préfixe URL est `/api/contacts/` — *source : `config/urls.py:23`*
- Décision architecturale figée : **pas de sync CardDAV bi-directionnelle** avec iCloud/Google. Justification multi-membre + catalogues différents — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §1*
- `Address`, `Email`, `Phone` peuvent être attachés soit à un `Contact`, soit à une `Structure` (FK nullables) — *source : `apps/directory/models.py:63-153`*
- Résolution du champ `ORG` à l'import : jamais automatique, toujours confirmation explicite par défaut "Ignorer" si aucun match — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §4.5*
