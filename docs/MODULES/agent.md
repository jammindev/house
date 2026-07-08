# Module — agent

> Rôle : assistant conversationnel du foyer (RAG + function calling). Répond en langage naturel sur les données du foyer, avec citations vérifiables. Accessible en pleine page (`/app/agent/`) **ou** ancré sur une entité précise (onglet « Assistant » d'un projet, etc.).

## État synthétique

- **Backend** : `apps/agent/` — orchestrateur (`service.py`), tools function-calling (`tools.py`), retrieval full-text (`retrieval.py`), registry des entités searchables (`searchables.py`), prompts (`prompts.py`), contexte ancré (`context.py`), persistance conversations (`models.py`).
- **Frontend** : `ui/src/features/agent/` — `AgentPage` (pleine page, sidebar de conversations), `EntityAssistant` (chat ancré sans sidebar), `ChatBubble` (markdown + citations), `PrivacyNotice`.
- **Locales (en/fr/de/es)** : namespace `agent` (dont `agent.entity.*` pour le chat ancré, `agent.memory.*` pour la mémoire utilisateur).
- **Mémoire utilisateur** : `apps/agent/memory.py` (service), modèle `AgentMemory`, tool `manage_memory`, page `ui/src/features/agent/MemoryPage.tsx`, toggle `AgentMemorySection` dans les réglages.
- **Tests** : `apps/agent/tests/` — `test_service.py`, `test_tools.py`, `test_context.py`, `test_conversations_api.py`, `test_retrieval.py`, `test_prompts.py`, `test_registry.py`, `test_query_expansion.py`, `test_retention.py`, `test_llm.py`, `test_models.py`, `test_views.py`, `test_memory.py`.

## Boucle agent (function calling)

`service.ask(question, household, *, user, history, context_entity)` : boucle
tool-use bornée par `AGENT_MAX_TOOL_ITERATIONS`. Trois tools read-only enregistrés
dans `tools.REGISTRY` :

- `search_household(query)` — expansion de requête + retrieval scellé au foyer ;
- `get_entity(entity_type, id)` — contenu complet d'un item ;
- `get_related(entity_type, id)` — tout ce qui est lié à un item (via `spec.related`).

Les citations `<cite id="type:id"/>` sont intersectées avec le pool de hits
réellement retournés (citations honnêtes, cf. `_resolve_citations`).

Un **4ᵉ tool, d'écriture**, complète les trois de lecture :

- `create_entity(entity_type, fields)` — crée un item du foyer (aujourd'hui :
  `task`, `note`). Un seul tool générique, adossé au registry `writables` (cf. plus bas).
  L'item créé est renvoyé comme Hit citable + remonté dans
  `metadata.created_entities` pour l'Undo côté client. Livré au **lot 8** (voir
  `docs/parcours/PARCOURS_07_LOT8_ACTIONS_ECRITURE.md`).

## Registry d'écriture `writables` — rendre une entité créable

Miroir de `searchables`, pour l'écriture. Chaque app déclare depuis
`apps.py::ready()` :

```python
from agent.writables import WritableSpec, register as register_writable

register_writable(WritableSpec(
    entity_type='task',
    create=_create_task_from_agent,   # (household, user, fields, *, anchor) -> instance
    label_attr='subject',
    url_template='/app/tasks/{id}',
))
```

Règles :
- `create` **réutilise le service métier** de l'app (jamais l'ORM brut) — ex.
  `tasks.services.create_task` qui passe par `TaskSerializer` (validation, scope
  foyer, fallback zone racine).
- `create` reçoit l'`anchor` de la conversation ancrée `(entity_type, object_id)`
  et l'utilise pour pré-remplir un lien (ancre `project` → tâche liée au projet).
- Rendre une entité créable = **registrer un `WritableSpec`** + étendre la
  description du tool `create_entity`. Zéro touche à `apps/agent/tools.py` sur le
  fond.

**Garde-fous d'écriture** : prompt strict (créer seulement sur demande explicite),
anti-doublon par tour (`service.ask`), et **Undo** côté client (toast « Annuler »
qui supprime l'item). Une écriture est un effet de bord réversible, pas une
proposition à valider.

**Undo backend (`delete`)** : `WritableSpec` porte un champ optionnel
`delete(household, user, object_id)` — miroir serveur des `UNDO_HANDLERS` du
front, appelé par les canaux non-web (bouton « Annuler » de Telegram) via le
point d'entrée unique `writables.delete_created(...)`. Il réutilise le service
métier de la DELETE API (`task` → archive, `note` → delete) et lève `LookupError`
si l'item est déjà parti (double-tap idempotent). Voir
[telegram.md](./telegram.md).

## Conversation, tous canaux — `conversations.py`

`agent.conversations` factorise les deux gestes autour de `ask()` quand une
conversation persistée est en jeu : `ask_inputs(conversation)` (historique borné
+ ancre) et `persist_turns(conversation, question, user, result)` (écriture
atomique des deux tours, auto-titre, `last_message_at`). Les vues DRF **et** le
canal Telegram s'en servent — même sémantique partout, pas de re-dérivation.

## Registry searchable — ajouter une entité

Chaque app déclare ses entités depuis `apps.py::ready()` via
`agent.searchables.register(SearchableSpec(...))` (entity_type, model,
search_fields, label_attr, url_template, `related` optionnel). L'agent ne connaît
pas la liste — ajouter un module = ~5 lignes, zéro touche à `apps/agent/`.

## Conversation ancrée sur une entité (2026-07)

Une `AgentConversation` peut porter une ancre optionnelle
`(context_entity_type, context_object_id)` — mêmes strings que l'adressage des
tools. Quand elle est présente, chaque `ask` **pré-injecte** le contexte de
l'entité (contenu complet + items liés, via `agent.context.build_entity_context`)
en tête de conversation et seed ces hits dans le pool de citations ; le system
prompt reçoit `ANCHORED_ADDENDUM` (réponds/cite sans chercher). Le contexte est
ré-injecté à chaque tour (reste frais), borné par les budgets `RELATED_*`.

### Réutiliser ailleurs (zones, équipements…) — mode d'emploi

1. **Prérequis** : l'entité doit être enregistrée dans `agent.searchables` (elle
   l'est déjà pour project/zone/equipment/…). Un `related` sur le spec enrichit le
   contexte injecté, mais n'est pas obligatoire.
2. **Frontend** : poser le composant générique dans la vue de l'entité —
   `<EntityAssistant entityType="zone" objectId={zone.id} />`. Rien d'autre.
3. **Sous le capot** : `EntityAssistant` appelle
   `GET /api/agent/conversations/for_context/?entity_type=…&object_id=…` qui
   **get-or-create** l'unique conversation `(household, user, entité)`, puis
   réutilise `POST conversations/{id}/messages/` — la view détecte l'ancre et
   passe `context_entity` à `service.ask`.

Aucune modification de `apps/agent/` n'est nécessaire pour brancher une nouvelle
entité.

## Mémoire utilisateur (2026-07)

L'agent retient des **faits durables sur l'utilisateur** (préférences, habitudes,
contexte perso) au fil des conversations — distinct des données du foyer, qui
vivent dans leurs propres modèles et **priment** toujours en cas de conflit.

- **Modèle `AgentMemory`** (`HouseholdScopedModel`, champ `content` ≤ 500 car.),
  scopé `(household, created_by)` : privé par utilisateur, jamais partagé entre
  membres. Comme les conversations, **pas** dans `searchables` — les mémoires
  sont injectées telles quelles dans le system prompt, jamais retrouvées/citées.
- **Service `apps/agent/memory.py`** = source de vérité des écritures (comme
  `tasks/services.py`) : `save`/`update`/`forget`/`clear`, `user_memories`,
  `resolve_memory`, cap `MEMORY_LIMIT=50` (les plus anciennes sont élaguées
  silencieusement). Le tool ET le viewset REST passent par lui.
- **Tool `manage_memory(action, content, memory_id)`** (`save`/`update`/`forget`).
  Chaque écriture remonte dans `ToolResult.memories` → `metadata.memory_events`
  (`{action, id, content, previous?}`), pour l'undo front + l'indication 📌.
- **Injection + capture** (`service.ask_stream` + `prompts.build_system_prompt`) :
  - `agent_memory_enabled=True` → mode `auto` : mémoires injectées (avec leur
    `memory_id`) + capture spontanée autorisée.
  - flag `False` → mode `manual` : le tool reste décrit (pour un « retiens
    que… » explicite) mais **rien n'est injecté ni capté automatiquement**.
  - pas d'`user` (bare `ask`, tests) → la mémoire n'est pas mentionnée du tout.
- **Toggle** : champ `User.agent_memory_enabled` (défaut `True`), exposé par
  `UserSerializer` et patchable via `PATCH /accounts/users/me/`.
- **Frontend** : `MemoryPage` (`/app/agent/memory`) liste/édite/supprime (undo) +
  « tout effacer » (confirm) ; `AgentMemorySection` (réglages) = toggle + lien ;
  `useAgentMemoryEvents` (toast undo) + `MemoryNotice` (ligne 📌 persistante dans
  la bulle, rejouée depuis `metadata.memory_events`).

## API

Sous `/api/agent/` :

- `POST ask/` — one-shot (sans persistance).
- `conversations/` (CRUD, privé par user × foyer) ; `POST {id}/messages/` — pose
  une question dans une conversation (history = tours précédents, bornée).
- `POST {id}/messages/stream/` — variante **SSE** du même appel, utilisée par
  l'UI : événements `delta` (morceau de texte), `tool` (tool en cours
  d'exécution), puis un terminal `done` (le message agent persisté, même
  payload que l'endpoint non-streamé) ou `error`. Persistance identique (les
  deux tours ne sont écrits qu'une fois la réponse obtenue). Chaîne interne :
  `AnthropicClient.run_stream` (SDK `messages.stream`) → `service.ask_stream`
  (générateur, `ask()` le draine pour les appels non-streamés) → view SSE.
- `GET conversations/for_context/?entity_type=&object_id=` — get-or-create de la
  conversation ancrée d'une entité pour l'utilisateur courant.
- `memories/` (CRUD, privé par user × foyer) + `DELETE memories/clear/` (efface
  tout, renvoie `{deleted: n}`) — mémoire utilisateur.
- Permissions : `IsAuthenticated, IsHouseholdMember` ; `ask`, `messages` et
  `messages/stream` sont throttlés (`agent_burst`/`agent_sustained`).

## Notes / décisions

- Les modèles `AgentConversation`/`AgentMessage` ne sont **pas** enregistrés dans
  `searchables` : ce sont les transcripts de l'agent, jamais de la connaissance
  foyer.
- Ancre = couple de strings (pas de GenericFK) pour rester cohérent avec le
  langage `entity_type:id` des tools. Entité supprimée → ancre orpheline →
  `build_entity_context` renvoie `None`, la conversation continue sans contexte.
- `AIUsageLog` trace chaque appel LLM (feature, provider, model, durée, tokens),
  **pas** le contenu des prompts/réponses.
- Confidentialité : modale non-dismissible avant première utilisation
  (`PrivacyNotice` + `privacyStorage`), partagée entre `AgentPage` et
  `EntityAssistant`.

Voir aussi : fiche concept [docs/fiches/RAG.md](../fiches/RAG.md) (section « conversation ancrée »), parcours [PARCOURS_07](../parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md).
