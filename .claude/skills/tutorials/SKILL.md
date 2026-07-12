---
name: tutorials
description: Compléter ou mettre à jour la page Tutoriel (/app/tutorial) après l'implémentation d'une feature — nouveau guide, nouvelle étape ou item « Bien démarrer », dans le registre + les 4 locales. Utiliser à la fin de toute feature qui change le parcours utilisateur, ou quand l'utilisateur demande de mettre à jour les tutoriels.
allowed-tools: Read, Edit, Grep, Glob, Bash
---

## Architecture de la page Tutoriel

Le contenu des tutoriels est **du code, pas de la donnée** : versionné en git,
revu en PR, traduit dans les 4 locales. Aucune table de contenu côté backend.

- **Registre** : `ui/src/features/tutorials/content.ts`
  - `TUTORIAL_GUIDES` — un guide par module/page (clé, `moduleKey` ou `Icon`,
    deep-link `to`, `stepIds`).
  - `GETTING_STARTED` — la checklist « Bien démarrer » (6 items max, les
    premières actions clés).
- **Prose** : namespace `tutorials` des 4 fichiers
  `ui/src/locales/{en,fr,de,es}/translation.json`
  - guide → `tutorials.guide.<key>.title` / `.intro` et
    `tutorials.guide.<key>.steps.<stepId>.title` / `.body`
  - checklist → `tutorials.start.items.<key>.title` / `.description`
- **Progression** : `User.completed_tutorials` (liste de clés opaques
  `guide.<key>` / `start.<key>`). Le backend ne valide que la forme —
  **ne jamais toucher au backend pour ajouter/modifier un tutoriel**.
- Un guide avec `moduleKey` hérite de l'icône du module (`ui/src/lib/modules.ts`)
  et est masqué si le module est désactivé pour le foyer.

## Quand mettre à jour quoi

| La feature livrée… | Action |
|---|---|
| crée un **nouveau module** (entrée sidebar) | Nouveau guide : entrée dans `TUTORIAL_GUIDES` avec `moduleKey`, 2-4 `stepIds`, clés i18n ×4 |
| ajoute une **capacité majeure** à un module existant | Nouveau `stepId` dans le guide existant (ou reformuler une étape) + clés i18n ×4 |
| change un **flux décrit** par une étape existante | Mettre à jour les `body` concernés dans les 4 locales |
| devient une **première action essentielle** d'un nouveau foyer | Item dans `GETTING_STARTED` (rester ≤ 6-7 items, retirer le moins utile si besoin) |
| supprime/renomme un module ou un flux | Retirer/adapter le guide et ses clés i18n (les clés de progression orphelines sont inoffensives) |

Changement purement interne (refactor, perf, fix sans impact visible) → rien à faire.

## Règles d'écriture

1. **Titres orientés action** : « Gérer les tâches », « Créer vos zones » — pas
   de titres descriptifs plats.
2. **2 à 4 étapes par guide**, une idée par étape, `body` en 1-2 phrases max.
   Un tutoriel n'est pas une doc exhaustive : le but est de faire faire la
   première action.
3. **`stepIds` sémantiques** (`create`, `readings`, `budget`…) — jamais de
   numéros : on peut insérer/réordonner sans casser les traductions.
4. **4 locales toujours** (en, fr, de, es), mêmes clés partout — voir skill
   `/translate` pour les conventions. Jamais de `defaultValue`.
5. Le `to` du guide/item pointe vers la page réelle (deep-link), pas vers `/app`.

## Procédure

1. Lire `ui/src/features/tutorials/content.ts` et repérer si la feature touche
   un guide existant ou en justifie un nouveau (table ci-dessus).
2. Modifier le registre (`TUTORIAL_GUIDES` / `GETTING_STARTED`).
3. Ajouter/modifier les clés dans les **4** fichiers de locales, dans le
   namespace `tutorials`, en respectant la structure existante.
4. Vérifier la cohérence registre ↔ locales :

```bash
python3 - <<'EOF'
import json, re
src = open('ui/src/features/tutorials/content.ts', encoding='utf-8').read()
guides = {k: re.findall(r"'([\w-]+)'", s)
          for k, s in re.findall(r"\{ key: '([\w-]+)'.*?stepIds: \[([^\]]*)\]", src)}
start = set(re.findall(r"\{ key: '([\w-]+)', to: '[^']+'(?:, moduleKey: '[\w-]+')? \}", src))
for lang in ('en', 'fr', 'de', 'es'):
    t = json.load(open(f'ui/src/locales/{lang}/translation.json', encoding='utf-8'))['tutorials']
    assert set(t['guide']) == set(guides), (lang, set(t['guide']) ^ set(guides))
    for k, steps in guides.items():
        assert set(t['guide'][k]['steps']) == set(steps), (lang, k)
        assert 'title' in t['guide'][k] and 'intro' in t['guide'][k], (lang, k)
    assert set(t['start']['items']) == start, (lang, set(t['start']['items']) ^ start)
print('OK — registre et 4 locales cohérents')
EOF
```

5. `npm run lint` + `npm run build` (le build attrape les erreurs TS).
6. Si le flux couvert est critique, compléter `e2e/tutorials.spec.ts`.
