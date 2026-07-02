# 2026-07-02 — Parcours 07 Lot 8 : actions d'écriture

## Contexte

L'agent conversationnel était *read-only* depuis le lot 7 (boucle tool-use, 3 tools
de lecture : `search_household`, `get_entity`, `get_related`). Il savait tout
consulter mais ne pouvait rien faire — alors que l'usage naturel d'un assistant
foyer est autant « note ça » / « rappelle-moi de… » que « combien j'ai payé ? ».

Ce lot concrétise « Extension 1 / #50 » : donner à l'agent la capacité de **créer**.

Contrainte directrice de l'utilisateur : **ne pas multiplier les définitions de
tools** (c'est ce qui encombre le modèle). On refuse `create_task` +
`create_expense` + … et on pose **un seul tool générique** `create_entity`.

Décisions produit : sécurité = **créer + Undo** (pas de modale de confirmation) ;
première entité créable = **tâche seule**.

## Ce qui a été livré

### Registry d'écriture `writables` + service métier

- `apps/agent/writables.py` — miroir écriture de `searchables`. `WritableSpec`
  (entity_type, `create`, label_attr, url_template) + registry.
- `apps/tasks/services.py::create_task` — source unique de la création de tâche
  (fallback zone racine + `TaskSerializer`), réutilisable par l'API plus tard.
- `apps/tasks/apps.py` enregistre le `WritableSpec` `task` et résout l'ancre de
  conversation (projet → tâche liée au projet).

### Tool `create_entity`

- `apps/agent/tools.py` — 4ᵉ tool (générique). Résout le `WritableSpec`, appelle le
  service, renvoie l'item comme Hit citable + un `created` pour l'undo. Erreurs de
  validation (DRF + Django) et exceptions → messages récupérables (jamais de crash
  de boucle).
- `ToolResult.created` + `dispatch(context_entity=…)` pour transmettre l'ancre.
- `apps/agent/service.py` accumule `metadata.created_entities` + garde-fou
  anti-doublon par tour.
- `apps/agent/prompts.py` — garde-fous : créer seulement sur demande explicite,
  jamais en double, confirmer + citer après création.

### Frontend — Undo

- `useAgentCreatedUndo()` (`agent/hooks.ts`) : toast « Créé · Annuler » par item,
  branché dans `EntityAssistant` **et** `AgentPage`. Map `entity_type → delete`
  (`task` → `deleteTask`, soft-delete `archived`).
- i18n `common.undo` + `agent.created.title` (en/fr/de/es).

### Tests

- `test_writables.py`, `test_tools.py::TestCreateEntity`, `test_services.py`
  (tasks), `test_service.py::TestCreateEntity`, `test_conversations_api.py`
  (`created_entities` dans la réponse).

## Décisions & compromis

- **1 tool générique, N entités** (via registry) plutôt qu'un tool par entité —
  aligné sur le côté lecture. Total : 4 tools.
- **Créer + Undo** plutôt que draft-à-valider : moins de friction, moins de front,
  et l'item reste réversible. On n'a pas repris le pattern `needs_review` du
  transverse pour ce cas.
- **Jamais d'ORM brut** : la création passe par le service métier de l'app.

## Reste à faire

- Recette manuelle à l'usage (repérer créations mal parsées / en double).
- Prochaines entités créables (`interaction`/dépense, `stock`…) : même tool,
  ~5 lignes chacune.
- Édition/suppression par l'agent (au-delà de l'Undo immédiat) : non tranché.

Doc lot : [PARCOURS_07_LOT8_ACTIONS_ECRITURE.md](../parcours/PARCOURS_07_LOT8_ACTIONS_ECRITURE.md)
