# Module — directory

> Audit : 2026-04-28. Rôle : carnet d'adresses partagé du foyer (contacts + structures).

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

## Notes / décisions produit

- L'app Django s'appelle `directory` mais le préfixe URL est `/api/contacts/` — *source : `config/urls.py:23`*
- Décision architecturale figée : **pas de sync CardDAV bi-directionnelle** avec iCloud/Google. Justification multi-membre + catalogues différents — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §1*
- `Address`, `Email`, `Phone` peuvent être attachés soit à un `Contact`, soit à une `Structure` (FK nullables) — *source : `apps/directory/models.py:63-153`*
- Résolution du champ `ORG` à l'import : jamais automatique, toujours confirmation explicite par défaut "Ignorer" si aucun match — *source : `docs/SYNC_CONTACTS_STRUCTURES.md` §4.5*
