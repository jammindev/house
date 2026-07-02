# Parcours 07 — Lot 8 : Actions d'écriture (l'agent crée des choses)

> **État : ✅ livré, 2026-07** — l'agent passe de *read-only* à *read + write*.
> Concrétise « Extension 1 / #50 » du lot 7 : créer un item du foyer depuis le
> chat (« ajoute une tâche », « rappelle-moi de… »). Première entité créable : la
> **tâche**. Sécurité par **création + Undo**, pas de modale de confirmation.
>
> Socle : [PARCOURS_07_LOT7_FUNCTION_CALLING.md](./PARCOURS_07_LOT7_FUNCTION_CALLING.md)
> Doc produit : [PARCOURS_07_AGENT_CONVERSATIONNEL.md](./PARCOURS_07_AGENT_CONVERSATIONNEL.md)
> Fiche module : [docs/MODULES/agent.md](../MODULES/agent.md)

## 1. Pourquoi ce lot

Le lot 7 a posé la boucle tool-use avec **3 tools de lecture**
(`search_household`, `get_entity`, `get_related`). L'agent sait tout consulter,
mais ne peut **rien faire**. Or l'usage naturel d'un assistant foyer est autant
« note ça » / « rappelle-moi de… » que « combien j'ai payé ? ».

### La contrainte directrice

> Ne pas multiplier les *définitions* de tools — c'est ça qui encombre le modèle,
> pas le nombre d'appels.

On refuse donc l'anti-pattern `create_task` + `create_expense` + `create_note` +
`create_stock`… (6 tools qui se ressemblent). On applique au côté écriture la même
philosophie que la lecture : **un seul tool générique** `create_entity`, adossé à
un registry (`writables`). Total : 3 read + 1 write = **4 tools**, extensible à N
entités sans toucher `apps/agent/`.

### Le risque à maîtriser

Une écriture est un **effet de bord** : le modèle peut mal parser, créer en
double, ou créer sans qu'on le demande. Garde-fous (§5) : prompt strict (créer
seulement sur demande explicite), anti-doublon par tour, et **Undo** côté client
(l'item créé est réversible en un clic).

## 2. Architecture cible

```
create_entity(entity_type, fields)                 ← 1 tool, N entités
        │
        ▼
writables.find_spec(entity_type)  →  WritableSpec.create(household, user, fields, anchor)
        │                                   │
        │                                   └─ réutilise le service métier de l'app
        │                                      (tasks.services.create_task → TaskSerializer)
        ▼
ToolResult(rendered, hits=[hit_citable], created=[{entity_type,id,label,url_path}])
        │
        ▼
service.ask : accumule `created` → metadata.created_entities
        │
        ▼
frontend : toast « Créé · Annuler » (useAgentCreatedUndo) + citation cliquable
```

Points clés :
- **Symétrie avec la lecture** : `writables.py` est le miroir de `searchables.py`.
- **Jamais d'ORM brut** : la création passe par le **service métier** de l'app
  (`tasks/services.py::create_task`), qui réutilise `TaskSerializer` — validation,
  scope foyer, fallback zone racine restent à un seul endroit.
- **`AnswerResult` et la signature de `ask()` ne changent pas** ; on n'ajoute
  qu'une clé `metadata.created_entities`. Le reste du backend/API est intact.

## 3. Le registry d'écriture `writables` (le socle)

`apps/agent/writables.py` (nouveau), même pattern que `searchables` :

```python
@dataclass(frozen=True)
class WritableSpec:
    entity_type: str                       # "task"
    create: Callable                        # (household, user, fields, *, anchor) -> instance
    label_attr: str | Callable              # libellé de l'item créé
    url_template: str                       # "/app/tasks/{id}"

REGISTRY: dict[str, WritableSpec] = {}
def register(spec): ...
def find_spec(entity_type): ...
def supported_entity_types(): ...           # pour la description du tool
def as_created_dict(spec, instance): ...    # {entity_type, id, label, url_path}
```

Chaque app enregistre depuis `apps.py::ready()`. **Rendre une entité créable =
~5 lignes**, zéro touche à `apps/agent/`.

## 4. Le tool `create_entity` + le contrat

`apps/agent/tools.py` :
- Schéma : `{ entity_type: str, fields: object }`. La description énumère (borné)
  les entités créables et leurs champs — aujourd'hui `task` → `subject` (requis),
  `content`, `due_date` (`YYYY-MM-DD`), `priority` (1..5).
- Handler : résout le `WritableSpec` (type inconnu → `ToolResult` récupérable qui
  liste les types créables), appelle `spec.create(household, user, fields,
  anchor=context_entity)`, attrape les `ValidationError` (DRF **et** Django) et
  toute exception → message récupérable (jamais de crash de boucle).
- Renvoie l'item **comme Hit citable** (via son `SearchableSpec`, donc citable
  exactement comme une donnée retrouvée) + un `created` pour l'undo.
- `ToolResult` gagne un champ `created: list[dict]`.

**Scope depuis l'ancre** : `service.ask` transmet le `context_entity` de la
conversation ancrée au `dispatch`. Le `WritableSpec` de la tâche le résout : ancre
`project` → tâche liée au projet ; ancre `zone` → tâche dans cette zone. Dans
l'onglet Assistant d'un projet, « ajoute une tâche » suffit.

## 5. Garde-fous

1. **Prompt système** (`prompts.py`) : ne créer que sur demande **explicite** ;
   jamais de création spéculative ni en double ; si l'item est ambigu (pas de
   sujet), poser une question avant ; après succès, confirmer en une phrase et
   **citer** le nouvel item ; pas de demande de confirmation (l'Undo couvre ça).
2. **Anti-doublon par tour** (`service.ask`) : si le modèle rappelle le même
   `create_entity` (même `entity_type` + mêmes `fields`) dans la même boucle
   tool-use, la 2ᵉ écriture DB est **court-circuitée** et on le signale au modèle.
3. **Undo client** : chaque item créé remonte dans `metadata.created_entities` ;
   le front affiche un toast « Créé · Annuler » (8 s) qui supprime (archive) l'item
   au clic. Réutilise le pattern toast + `deleteTask` (soft-delete `archived`).

## 6. Fichiers touchés

**Backend**
- `apps/agent/writables.py` (nouveau) — registry d'écriture.
- `apps/tasks/services.py` (nouveau) — `create_task(...)` (fallback zone racine,
  `TaskSerializer`).
- `apps/tasks/apps.py` — enregistre le `WritableSpec` `task` + mapping/anchor.
- `apps/agent/tools.py` — tool `create_entity`, `ToolResult.created`,
  `dispatch(context_entity=…)`, `_stable_signature`.
- `apps/agent/apps.py` — `register(build_create_entity_tool())`.
- `apps/agent/service.py` — passe l'ancre au dispatch, accumule
  `metadata.created_entities`, anti-doublon.
- `apps/agent/prompts.py` — garde-fous d'écriture.

**Frontend**
- `ui/src/features/agent/api.ts` — type `AgentCreatedEntity` + `created_entities`.
- `ui/src/features/agent/hooks.ts` — `useAgentCreatedUndo()` (map `entity_type →
  delete`).
- `EntityAssistant.tsx` + `AgentPage.tsx` — appel après réponse.
- `locales/*` — `common.undo`, `agent.created.title`.

## 7. Tests

- `apps/agent/tests/test_writables.py` — registry.
- `apps/agent/tests/test_tools.py::TestCreateEntity` — crée une tâche (hit citable
  + `created`), champs optionnels, ancre projet, type inconnu récupérable, sujet
  manquant récupérable, scope foyer.
- `apps/tasks/tests/test_services.py` — `create_task` (fallback racine, champs,
  projet, sujet vide → 400).
- `apps/agent/tests/test_service.py::TestCreateEntity` — `created_entities` peuplé,
  ancre → projet, anti-doublon, aucun write → liste vide.
- `apps/agent/tests/test_conversations_api.py` — la réponse POST message porte
  `created_entities`.

> **Extension 2026-07-03 — `note` créable.** 2ᵉ entité branchée, pour valider que
> le pattern tient hors « tâche » : `entity_type='note'` → `Interaction(type=note)`
> via `interactions/services.py::create_note_interaction`, enregistré dans
> `interactions/apps.py`, undo `note → deleteInteraction`. Coût réel : ~1 service +
> 1 `WritableSpec` + 1 entrée `UNDO_HANDLERS` + description du tool étendue. La note
> est citée comme `interaction` (son `SearchableSpec`) mais son type *writable* reste
> `note` (clé de l'undo). En conversation ancrée projet, la note atterrit dans la
> timeline du projet.

## 8. Hors scope de ce lot

- Autres entités créables (`expense`, `stock`…) — même tool, +5 lignes,
  livraison suivante.
- **Édition / suppression** par l'agent (au-delà de l'Undo immédiat).
- Le pattern `needs_review` (proposition vs vérité) du transverse — ici on tranche
  « créer + Undo » plutôt que « draft à valider ».

## 9. Definition of done

1. ✅ Un seul tool d'écriture ajouté (`create_entity`) — 4 tools au total.
2. ✅ « ajoute une tâche : purger la VMC samedi » crée la tâche, l'agent confirme
   avec une citation cliquable, un toast « Annuler » la retire.
3. ✅ Dans l'onglet Assistant d'un projet, la tâche créée est **liée au projet**.
4. ✅ Un simple « bonjour » ne crée rien (`created_entities` vide).
5. ✅ Rendre une nouvelle entité créable = registrer un `WritableSpec`, sans
   toucher `apps/agent/`.
6. ⏳ Recette manuelle à l'usage (repérer les créations mal parsées / en trop).
