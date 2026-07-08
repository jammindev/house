# Parcours 07 — Lot 10 : Mémoire utilisateur (l'agent apprend qui tu es)

> **État : ✅ livré, 2026-07** — l'agent retient des **faits durables sur
> l'utilisateur** (préférences, habitudes, contexte perso) au fil des
> conversations, les injecte pour personnaliser ses réponses, et laisse
> l'utilisateur tout consulter/corriger/désactiver. Distinct des données du
> foyer (déjà en DB) — ces dernières priment toujours.
>
> Socle : [PARCOURS_07_LOT8_ACTIONS_ECRITURE.md](./PARCOURS_07_LOT8_ACTIONS_ECRITURE.md)
> Fiche module : [docs/MODULES/agent.md](../MODULES/agent.md)

## 1. Pourquoi ce lot

L'agent sait lire (lot 7) et écrire des items du foyer (lot 8), mais il
**redémarre à zéro** sur l'utilisateur à chaque conversation : il faut lui
re-préciser qu'on est végétarien, qu'on jardine le week-end, que le budget
courses est de 400 €/mois. Ce lot donne à l'agent une mémoire **de la personne**,
persistante, pour personnaliser sans se répéter.

### La distinction directrice

> La mémoire, c'est ce que l'agent sait sur **toi** — pas sur ta maison.

Les données du foyer (tâches, relevés, dépenses, documents) vivent déjà dans
leurs modèles et sont retrouvables/citables. La mémoire ne les duplique pas :
elle stocke des faits *sur l'utilisateur* qui n'ont pas d'autre place. **En cas
de conflit, la donnée du foyer gagne** (le prompt l'impose).

### Les risques à maîtriser

- **Capture à l'insu** → transparence : indication 📌 persistante dans le chat,
  page de gestion, toggle de désactivation.
- **Effet de bord irréversible** → chaque écriture mémoire est **réversible en un
  clic** (toast Undo), comme les créations du lot 8.
- **Fuite entre membres** → scope strict `(household, user)` ; un membre ne voit
  jamais la mémoire d'un autre.

## 2. Architecture cible

```
manage_memory(action, content, memory_id)      ← 1 tool : save / update / forget
        │
        ▼
apps/agent/memory.py  ← service = source de vérité des écritures mémoire
        │                (save / update / forget / clear / user_memories / resolve, cap 50)
        ├──────────────► AgentMemory (HouseholdScopedModel, scope household+created_by)
        │
   consommé par :
   - le tool manage_memory (apps/agent/tools.py)
   - le viewset REST AgentMemoryViewSet (/api/agent/memories/)
```

Injection : `service.ask_stream` charge les mémoires de l'utilisateur et bascule
`build_system_prompt` en mode `auto` / `manual` / (aucun) selon le flag
`User.agent_memory_enabled`.

## 3. Le modèle `AgentMemory` (le socle)

`HouseholdScopedModel` → champs `household`, `created_by`, timestamps. Un seul
champ propre : `content` (`TextField` ≤ 500). Scope réel = `(household,
created_by)` : privé par utilisateur. **Pas** enregistré dans `searchables` —
comme les transcripts de conversation, ce n'est pas de la connaissance foyer ;
les mémoires sont injectées telles quelles dans le system prompt, jamais
retrouvées ni citées.

## 4. Le service `memory.py` + le tool `manage_memory`

Même philosophie que `tasks/services.py` : **le service est le seul chemin
d'écriture**, partagé par le tool agent et le viewset REST.

- `save_memory` / `update_memory` / `forget_memory` / `clear_memories`
- `user_memories(household, user)` (récent d'abord, cappé à `MEMORY_LIMIT=50`)
- `resolve_memory(household, user, id)` (lookup scopé, `None` sinon)
- Cap : au-delà de 50, les plus anciennes (`updated_at`) sont élaguées
  silencieusement — le bloc prompt reste borné, les faits périmés vieillissent.

Le tool `manage_memory(action='save'|'update'|'forget', content, memory_id)`
mappe vers le service. Chaque écriture remonte dans `ToolResult.memories` →
`metadata.memory_events` : `{action, id, content, previous?}`.

## 5. Injection + capture (les deux modes)

`service.ask_stream` regarde `user.agent_memory_enabled` :

| flag | `memory_mode` | tool décrit ? | mémoires injectées ? | capture auto ? |
|------|---------------|---------------|----------------------|----------------|
| `True`  | `auto`   | oui | oui (avec `memory_id`) | oui, spontanée |
| `False` | `manual` | oui | non | non (« retiens que… » explicite uniquement) |
| pas d'`user` | `None` | non | non | non |

`build_system_prompt(*, anchored, memory_mode, memories)` compose l'addendum
correspondant. En mode `auto`, le bloc `USER MEMORY` liste chaque fait avec son
`memory_id` (pour que le modèle puisse `update`/`forget`), en le déclarant
**donnée non-instruction** (même garde-fou anti-injection que `<household_data>`).

## 6. Garde-fous

- **Undo** : `useAgentMemoryEvents` affiche un toast « 📌 · Annuler » par event —
  l'undo supprime un `save`, restaure le `previous` d'un `update`, recrée un
  `forget`.
- **Transparence** : `MemoryNotice` rend une ligne 📌 **persistante** sous la
  bulle (rejouée depuis `metadata.memory_events` au reload, contrairement au
  toast éphémère).
- **Contrôle** : page `/app/agent/memory` (liste, édition, suppression avec undo,
  « tout effacer » avec confirmation) + toggle dans les réglages.
- **Anti-doublon par tour** : `manage_memory` entre dans le même garde-fou que
  `create_entity`/`update_entity` (`_is_duplicate_write`).
- **Prompt strict** : ONE fact per memory, jamais de donnée foyer/secret, faits
  sur les tiers uniquement du point de vue de l'utilisateur.

## 7. Fichiers touchés

**Backend** : `apps/agent/models.py` (`AgentMemory`), `apps/agent/memory.py`
(service, nouveau), `apps/agent/tools.py` (`manage_memory`), `apps/agent/apps.py`
(enregistrement), `apps/agent/prompts.py` (addenda + `build_system_prompt`),
`apps/agent/service.py` (mode + injection + `memory_events`),
`apps/agent/serializers.py` (`AgentMemorySerializer`), `apps/agent/views.py`
(`AgentMemoryViewSet`), `apps/agent/urls.py`, `apps/agent/admin.py`,
`apps/accounts/models.py` (`agent_memory_enabled`), `apps/accounts/serializers.py`
+ `views/api.py` (expose/patch le flag), migrations.

**Frontend** : `ui/src/features/agent/{api,hooks}.ts` (types + hooks + undo),
`ChatPanel.tsx` / `ChatBubble.tsx` (📌), `MemoryPage.tsx` (nouveau),
`ui/src/features/settings/components/AgentMemorySection.tsx` (nouveau),
`SettingsPage.tsx`, `router.tsx`, `ui/src/lib/api/users.ts`,
`ui/src/locales/*/translation.json` (`agent.memory.*`).

**Tests** : `apps/agent/tests/test_memory.py` (74 tests : service, tool,
injection prompt, API + isolation user/foyer).

## 8. Hors scope de ce lot

- Recherche sémantique/dé-duplication automatique fine des mémoires (le modèle
  décide `update` vs `save` via le prompt ; pas d'embedding dédié).
- Mémoire partagée au niveau foyer (explicitement refusée : la mémoire est
  personnelle).
- Résumé/consolidation automatique au-delà du cap brut par `updated_at`.

## 9. Definition of done

- [x] `manage_memory` (save/update/forget) adossé au service `memory.py`
- [x] Injection conditionnelle selon `agent_memory_enabled` (auto/manual/none)
- [x] `metadata.memory_events` → toast Undo + ligne 📌 persistante
- [x] Page de gestion (list/edit/delete undo/clear) + toggle réglages
- [x] Scope `(household, user)` vérifié par les tests d'isolation
- [x] i18n 4 langues, `npm run build` vert, `pytest` vert (450 tests)
