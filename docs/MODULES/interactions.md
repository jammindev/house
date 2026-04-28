# Module — interactions

> Audit : 2026-04-27. Rôle : journal d'événements household (note, dépense, maintenance, etc.) — cœur métier du parcours 01.

## État synthétique

- **Backend** : Présent (`Interaction` + `InteractionZone` + `InteractionContact` + `InteractionStructure` + `InteractionDocument`)
- **Frontend** : Complet dans `ui/src/features/interactions/` (`InteractionsPage`, `InteractionNewPage`, `InteractionEditPage`, `InteractionCard`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `interactions` présent dans les 4 fichiers (ligne 185)
- **Tests** : oui — 2 fichiers (`test_api_interactions.py`, `test_import_supabase_interactions.py`)
- **Migrations** : 12

## Modèles & API

- Modèles principaux : `Interaction`, `InteractionZone` (M2M obligatoire ≥1 zone), `InteractionContact`, `InteractionStructure`, `InteractionDocument` (lien canonique parcours 02)
- Endpoints exposés sous `/api/interactions/` : `interactions/` (CRUD + actions `by_type`, `tasks`, `update_status`), `interaction-contacts/`, `interaction-structures/`, `interaction-documents/` — pagination `LimitOffsetPagination` (default 8, max 100)
- Permissions : `IsHouseholdMember` (scoping household via middleware + `for_user_households`) ; pas de permission `is_creator` côté Interaction (contrairement à Task)

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] Audit du champ `occurred_at` : nullable mais contrainte CheckConstraint `interactions_occurred_at_required_for_non_todo` bloque la création de toute interaction non-`todo` sans date — source du BUG-06 sur les tâches — *source : `URGENT.md`, `GITHUB_ISSUES_BACKLOG.md` REFACTOR-01, `apps/interactions/models.py:135-138`*
- [ ] Filtrage par tags : `tags.split(',')` sans nettoyage des entrées vides → entrées `''` qui faussent le filtre (BUG-07) — *source : `apps/interactions/views.py:79`, `docs/SECURITY_REVIEW.md` lignes 128-135*
- [ ] Mécanisme de zone par défaut : ajouter une zone ancêtre unique par household pour autocompléter quand aucune zone n'est fournie côté formulaire — *source : `URGENT.md` ligne 2*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Capture assistée IA (WhatsApp / email / chat) produisant une interaction candidate structurée — *source : `GITHUB_ISSUES_BACKLOG.md` IDEA-01, `docs/IDEES_FUTURES.md` lignes 15-23, `docs/PARCOURS_01_CAPTURE_ASSISTEE_PAR_IA.md`*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Activer `autocomplete_fields = ['project']` et le fieldset Relations dans `InteractionAdmin` (post-stabilisation app projects) — *source : `apps/interactions/admin.py:20,34` ; `GITHUB_ISSUES_BACKLOG.md` REFACTOR-06*
- [ ] Déplacer `HouseholdScopedModelSerializer` (utilisé indirectement) vers `apps/core/serializers.py` — *source : `GITHUB_ISSUES_BACKLOG.md` REFACTOR-03*

## Notes

- `Interaction` reste le concept technique central même côté UI — l'interface privilégie le vocabulaire « Activité / Historique / Ajouter un événement » (`docs/JOURNAL_PRODUIT.md` lignes 55-61).
- Lien canonique avec les documents : `InteractionDocument` (M2M). Le champ `Document.interaction` (FK unique) reste présent à titre transitoire mais n'est plus la vérité métier (`PARCOURS_02_BACKLOG_TECHNIQUE.md` lignes 53-58).
- Lien `événement source → tâche` stocké dans `metadata.source_interaction_id` (pas de FK), choix V1 documenté dans `PARCOURS_03_BACKLOG_TECHNIQUE.md` lignes 132-140.
- Ordre de tri par défaut : `-occurred_at` (`apps/interactions/models.py:102`).
