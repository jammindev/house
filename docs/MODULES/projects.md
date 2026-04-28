# Module — projects

> Audit : 2026-04-27. Rôle : suivre un projet du foyer de bout en bout (rénovation, achat, vacances…) avec tâches, notes, dépenses et budget.

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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.
- [ ] Pouvoir lier directement un projet (select) dans la modale de création de tâche — *source : `TO_FIX.md` ligne 2*
- [ ] Quand on clique sur "nouvelle tâche" depuis un projet, ouvrir la même modale que dans la page tasks (cohérence UX) — *source : `TO_FIX.md` ligne 5*

## À faire (backlog)

> Features identifiées non encore commencées.
- [ ] UI pour `ProjectAIThread` / `ProjectAIMessage` — modèles et endpoints exposés mais aucun consommateur frontend hors types générés (`ui/src/gen/api/services/ProjectsService.ts`) — *source : `apps/projects/models.py:128-156`, absence dans `ui/src/features/projects/`*
- [ ] Couvrir `pin`/`unpin` et les actions custom par des tests — `apps/projects/tests/` n'a pas de `test_models.py` ni `test_serializers.py` ni `factories.py` — *source : `apps/projects/tests/` (manque aussi `__init__.py`)*

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] `actual_cost_cached` est stocké sur `Project` mais aucun mécanisme de recalcul automatique observé dans les vues — risque de drift avec les dépenses liées — *source : `apps/projects/models.py:49`*
- [ ] Pas de soft-delete : la suppression d'un projet supprime aussi ses `ProjectZone`, `ProjectDocument`, `ProjectAIThread` (CASCADE) — vérifier si c'est intentionnel — *source : `apps/projects/models.py:106, 117, 130`*
- [ ] Filtres `?zone=` et `?status=` sont parsés à la main au lieu d'utiliser `DjangoFilterBackend` (incohérent avec equipment/stock) — *source : `apps/projects/views.py:48-55`*

## Notes

- V1 livrée dans le Parcours 04 : boutons de création rapide (tâche, note, dépense, activité) dans chaque onglet du détail projet, bandeau projet dans `InteractionCreateForm`, bloc de synthèse en tête (tâches ouvertes/retard, budget), `project_title` exposé, `?tab=` lu depuis l'URL — *source : `docs/JOURNAL_PRODUIT.md` lignes 81-96*.
- `ProjectAIThread` et `ProjectAIMessage` sont en place côté modèle/API mais ne sont consommés par aucun composant React (présents uniquement dans `ui/src/gen/api/`) — feature en attente de cadrage produit.
- Un projet a une seule zone "couverture" (`cover_interaction`) mais peut être lié à plusieurs zones via `ProjectZone` (M2M).
- Contraintes DB strictes : priorité 1-5, budgets >= 0, `due_date >= start_date`.
