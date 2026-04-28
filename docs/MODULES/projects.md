# Module — projects

> Audit : 2026-04-28. Rôle : suivre un projet du foyer de bout en bout (rénovation, achat, vacances…) avec tâches, notes, dépenses et budget.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/projects/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — 4 fichiers (`test_api_projects.py`, `test_import_supabase_projects.py`, `test_import_supabase_project_links.py`, `test_import_supabase_user_pinned_projects.py`)
- **Migrations** : 6 total

## Modèles & API

- Modèles principaux : `Project` (status, type, dates, budget, cover_interaction) ; `ProjectGroup` ; `ProjectZone` (M2M zones) ; `ProjectDocument` ; `UserPinnedProject` ; `ProjectAIThread` + `ProjectAIMessage`
- Endpoints exposés : `/api/projects/projects/` (+ `pin/`, `unpin/`, filtres `?zone=`, `?status=`), `/project-groups/`, `/project-zones/`, `/project-ai-threads/`, `/project-ai-messages/`
- Permissions : `IsAuthenticated, IsHouseholdMember` (pas de custom)

## Notes / décisions produit

- V1 livrée dans le Parcours 04 : boutons de création rapide (tâche, note, dépense, activité) dans chaque onglet du détail projet, bandeau projet dans `InteractionCreateForm`, bloc de synthèse en tête (tâches ouvertes/retard, budget), `project_title` exposé, `?tab=` lu depuis l'URL — *source : `docs/JOURNAL_PRODUIT.md` lignes 81-96*.
- `ProjectAIThread` et `ProjectAIMessage` sont en place côté modèle/API mais ne sont consommés par aucun composant React — feature en attente de cadrage produit.
- Un projet a une seule zone "couverture" (`cover_interaction`) mais peut être lié à plusieurs zones via `ProjectZone` (M2M).
- Contraintes DB strictes : priorité 1-5, budgets >= 0, `due_date >= start_date`.
