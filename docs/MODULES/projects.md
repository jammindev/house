# Module — projects

> Audit : 2026-04-28. Rôle : suivre un projet du foyer de bout en bout (rénovation, achat, vacances…) avec tâches, notes, dépenses et budget.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/projects/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — 4 fichiers (`test_api_projects.py`, `test_import_supabase_projects.py`, `test_import_supabase_project_links.py`, `test_import_supabase_user_pinned_projects.py`)
- **Migrations** : 7 total (0007 = suppression de `ProjectAIThread`/`ProjectAIMessage`)

## Modèles & API

- Modèles principaux : `Project` (status, type, dates, budget, cover_interaction) ; `ProjectGroup` ; `ProjectZone` (M2M zones) ; `ProjectDocument` ; `UserPinnedProject`
- Endpoints exposés : `/api/projects/projects/` (+ `pin/`, `unpin/`, filtres `?zone=`, `?status=`), `/project-groups/`, `/project-zones/`
- Permissions : `IsAuthenticated, IsHouseholdMember` (pas de custom)

## Notes / décisions produit

- V1 livrée dans le Parcours 04 : boutons de création rapide (tâche, note, dépense, activité) dans chaque onglet du détail projet, bandeau projet dans `InteractionCreateForm`, bloc de synthèse en tête (tâches ouvertes/retard, budget), `project_title` exposé, `?tab=` lu depuis l'URL — *source : `docs/JOURNAL_PRODUIT.md` lignes 81-96*.
- **Onglet « Assistant » (2026-07)** : le détail projet expose un onglet chat branché sur l'agent RAG générique. Il s'appuie sur `<EntityAssistant entityType="project" objectId={id} />` (`ui/src/features/agent/`), lui-même adossé à une conversation `agent.AgentConversation` **ancrée** sur le projet (`context_entity_type='project'`, `context_object_id=<id>`). Au démarrage, tout le contexte du projet (détails + documents + dépenses + tâches + zones liés, via `spec.related`) est pré-injecté : l'IA connaît déjà le projet sans avoir à chercher. Voir `docs/MODULES/agent.md`.
- `ProjectAIThread` / `ProjectAIMessage` (thread IA dédié, jamais consommé) **supprimés le 2026-07** (migration `0007`) : l'onglet Assistant passe par l'agent générique, ce thread parallèle était mort.
- Un projet a une seule zone "couverture" (`cover_interaction`) mais peut être lié à plusieurs zones via `ProjectZone` (M2M).
- Contraintes DB strictes : priorité 1-5, budgets >= 0, `due_date >= start_date`.
