# Module — interactions

> Audit : 2026-04-28. Rôle : journal d'événements household (note, dépense, maintenance, etc.) — cœur métier du parcours 01.

## État synthétique

- **Backend** : Présent (`Interaction` + `InteractionZone` + `InteractionContact` + `InteractionStructure` + `InteractionDocument`)
- **Frontend** : Complet dans `ui/src/features/interactions/` (`InteractionsPage`, `InteractionNewPage`, `InteractionEditPage`, `InteractionCard`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `interactions` présent dans les 4 fichiers (ligne 185)
- **Tests** : oui — 2 fichiers (`test_api_interactions.py`, `test_import_supabase_interactions.py`)
- **Migrations** : 12

## Modèles & API

- Modèles principaux : `Interaction`, `InteractionZone` (M2M obligatoire ≥1 zone), `InteractionContact`, `InteractionStructure`, `InteractionDocument` (lien canonique parcours 02)
- Endpoints exposés sous `/api/interactions/` : `interactions/` (CRUD + action `by_type` ; les actions todo `tasks`/`update_status` ont été retirées avec le type `todo`, extrait vers le modèle Task), `interaction-contacts/`, `interaction-structures/`, `interaction-documents/` — pagination `LimitOffsetPagination` (default 8, max 100)
- Permissions : `IsHouseholdMember` (scoping household via middleware + `for_user_households`) ; pas de permission `is_creator` côté Interaction (contrairement à Task)

## Notes / décisions produit

- `Interaction` reste le concept technique central même côté UI — l'interface privilégie le vocabulaire « Activité / Historique / Ajouter un événement » (`docs/JOURNAL_PRODUIT.md` lignes 55-61).
- Lien canonique avec les documents : `InteractionDocument` (M2M). Le champ `Document.interaction` (FK unique) reste présent à titre transitoire mais n'est plus la vérité métier (`PARCOURS_02_BACKLOG_TECHNIQUE.md` lignes 53-58).
- Lien `événement source → tâche` stocké dans `metadata.source_interaction_id` (pas de FK), choix V1 documenté dans `PARCOURS_03_BACKLOG_TECHNIQUE.md` lignes 132-140.
- Ordre de tri par défaut : `-occurred_at` (`apps/interactions/models.py:102`).
- **Création par l'agent IA (lot 8, 2026-07)** : l'agent peut créer une **note** (`Interaction` type=note) via son tool `create_entity` (`entity_type='note'`). Logique dans `apps/interactions/services.py::create_note_interaction`, enregistrée comme `WritableSpec` dans `interactions/apps.py`. En conversation ancrée projet, la note atterrit dans la timeline du projet. Rejoint les services d'écriture existants (`create_expense_interaction`, `create_manual_expense_interaction`). Voir `docs/MODULES/agent.md`.
- **Les dépenses ont quitté la page Activité (2026-07)** : `/app/interactions` et le
  fil « Activité récente » du dashboard passent `?exclude_type=expense`. Une dépense
  reste une `Interaction` — sa fiche, son édition et son détail sont inchangés — mais
  elle ne se lit plus dans le journal : elle a son module, avec sa période, son
  budget et son badge de rapprochement, et à cent soixante lignes par mois elle
  noyait les notes et les maintenances. Trois points à préserver :
  - **`exclude_type` est un filtre serveur**, jamais un `.filter()` sur le résultat.
    La liste est paginée par huit : écarter des lignes après coup afficherait une
    page vide sous un compteur qui en annonce huit. Tests :
    `test_api_interactions.py::TestExcludingTypesFromTheList`.
  - **C'est un choix d'écran, pas une règle du modèle.** Sans le paramètre, rien
    n'est masqué — l'onglet Dépenses et l'onglet d'un projet lisent le même endpoint
    avec `?type=expense`.
  - **Le fil du dashboard applique la même exclusion** : son lien « Toute l'activité »
    mène à la page Activité, et y cliquer une dépense pour atterrir sur une liste qui
    ne la contient pas serait un cul-de-sac.
- **`InteractionNewPage` ne crée plus de dépense (2026-07)**, et ce n'était pas
  qu'une question de cohérence d'écran : ce formulaire écrivait `amount` et
  `supplier` dans `metadata`, où plus rien ne les lit depuis leur promotion en
  colonnes (`interactions.0024`). Une dépense saisie par ce chemin valait **0 €**
  dans tous les budgets et tous les totaux. `InteractionEditPage` écrit bien les
  colonnes ; c'était la seule voie fautive. La saisie ad hoc passe désormais par le
  module Argent (`CashExpenseDialog`).
- **Carnet de rénovation par zone (parcours 13, 2026-07)** : une entrée de carnet est une `Interaction` discriminée par `metadata.kind == "renovation"` — **aucun nouveau modèle**. Elle porte un `type` curaté (installation/replacement/upgrade/repair/maintenance) et des champs structurés en `metadata` (`element`, `product`, `brand`, `reference`), et s'appuie sur le M2M zones (une entrée peut couvrir N pièces — cas « toutes les menuiseries de la maison »). Services : `create_renovation_interaction` / `update_renovation_interaction` / `delete_renovation_interaction` (`services.py`), avec le builder `_build_renovation_metadata`. Endpoints : `POST /api/interactions/interactions/renovation/` + `PATCH .../{id}/renovation/`. UI : onglet « Rénovation » du détail zone (`ui/src/features/renovation/`). Agent : `WritableSpec(entity_type='renovation')` (create + undo) — l'**édition agent est volontairement hors périmètre** car le snapshot d'undo d'`update_entity` lit des attributs modèle, pas les clés `metadata` ; l'édition passe par l'UI/REST. Cadrage : `docs/parcours/PARCOURS_13_CARNET_DE_RENOVATION_PAR_ZONE.md`.
