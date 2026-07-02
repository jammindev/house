# 2026-07-03 — Agent : la note devient créable (extension lot 8)

## Contexte

Le lot 8 (2026-07-02) a donné à l'agent un tool d'écriture générique
`create_entity`, branché sur une seule entité : la **tâche**. Cette extension
ajoute la 2ᵉ entité — la **note** — pour valider que le pattern `writables` tient
hors du premier cas, et parce que « note ça » est un usage aussi naturel que
« ajoute une tâche ».

## Ce qui a été livré

- `apps/interactions/services.py::create_note_interaction` — crée un
  `Interaction(type=note)` (sujet requis, contenu/projet/zones optionnels), aux
  côtés des services d'écriture d'expense existants.
- `apps/interactions/apps.py` — enregistre le `WritableSpec` `note` + résout
  l'ancre (projet → note dans la timeline du projet, zone → note liée à la zone).
- `apps/agent/tools.py` — description du tool `create_entity` étendue à `note`.
- `ui/src/features/agent/hooks.ts` — `UNDO_HANDLERS.note` → `deleteInteraction`.
- Tests : `interactions/tests/test_services.py::TestCreateNoteInteraction`,
  `agent/tests/test_tools.py::TestCreateEntity` (note citée comme `interaction`,
  ancre projet).

## À noter

- La note est **citée comme `interaction`** (son `SearchableSpec`), mais son type
  *writable* reste `note` — c'est la clé de la map d'undo côté front. Les deux
  vocabulaires coexistent proprement.
- **Coût réel de la 2ᵉ entité** : ~1 service + 1 `WritableSpec` + 1 entrée
  `UNDO_HANDLERS` + description du tool. Le pattern tient : zéro touche au cœur
  `apps/agent/` (hors la description énumérative du tool).

Doc lot : [PARCOURS_07_LOT8_ACTIONS_ECRITURE.md](../parcours/PARCOURS_07_LOT8_ACTIONS_ECRITURE.md)
