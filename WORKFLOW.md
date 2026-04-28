# Workflow de dev solo — house

## Principe

Trunk-based sur `main`. Une seule branche long-lived, un seul environnement déployé (prod). GitHub Issues = mémoire externe.

```
Capture (issue) → Code (feature branch) → PR → Merge main → auto-deploy prod
```

Pas de `develop`, pas de staging. La latence "ça marche" → "c'est en prod" est ramenée à un merge.

---

## 1. Branches

- `main` : trunk. Auto-deploy prod (`house.jammin-dev.com`) à chaque push.
- `<type>/<app>-<desc>` : feature branches éphémères, partent de `main`, mergent dans `main`.

Convention de nommage :
```
fix/general-theme-logout       # bug
feat/tasks-delete              # feature
style/card-spacing             # visuel
refactor/core-household-view   # refacto
docs/workflow-trunk-based      # doc
```

Quand pousser direct sur `main` :
- typo, doc, fix d'une ligne avec test trivial, version bump.

Quand passer par une PR :
- toute feature, refacto, migration, changement de schéma, changement infra, fix > 1 fichier ou avec doute.

---

## 2. GitHub Issues — mémoire externe

Une issue = une unité de travail. Capturer même quand c'est flou (label `idea`).

**Labels par type** : `bug` · `feat` · `style` · `refactor` · `security` · `idea` · `docs`
**Labels par app** : `app:tasks` · `app:zones` · `app:electricity` · `app:directory` · `app:equipment` · `app:documents` · `app:stock` · `app:projects` · `app:interactions` · `app:insurance` · `app:auth` · `app:general`

Une issue peut combiner les deux (ex : `bug` + `app:tasks`).

**Milestones** = Parcours produit (01→06). Une issue produit reliée à un parcours est assignée à la milestone correspondante.

---

## 3. Cycle

### Capture
Ouvre une issue avec :
- Ce que ça fait / devrait faire
- Contexte (page, app, repro si bug)

Label `idea` si c'est flou, sinon `bug` / `feat` / `refactor`.

### Spec (optionnel — features non triviales)
Mentionne `@claude` dans l'issue avec ta question. Le Claude GitHub app répond dans le thread, ça laisse une trace de décision. Exemples :
- "Cette approche a des problèmes que je ne vois pas ?"
- "Compare ces deux implémentations"
- "Quels edge cases gérer en priorité ?"

### Code
```bash
git checkout main && git pull
git checkout -b fix/general-theme-logout
# code, commits, push
gh pr create --base main --title "fix(general): restore theme on logout" --body "Closes #42"
```

### PR
- Titre : `type(app): description`
- Body : `Closes #<numéro>` au minimum
- `@claude` dans la PR si tu veux une relecture
- CI vert (pytest backend + lint/build frontend) avant merge

### Merge → prod
Merge la PR (squash recommandé pour garder l'historique propre). GitHub Actions déploie automatiquement sur `house.jammin-dev.com`.

### Hotfix prod
Pas de cas particulier : tu fais un fix, tu pousses, c'est en prod. Si tu veux un peu de filet, ouvre une PR rapide pour que le CI tourne avant le merge.

---

## 4. Où Claude intervient

| Moment | Outil | Demande type |
|---|---|---|
| Capture floue | Claude Code (CLI) | "Bug ou comportement voulu ?" |
| Spec feature | Claude GitHub app (`@claude` dans issue) | Challenge, edge cases, plan |
| Coding | Claude Code (CLI) | Implémentation, debug, refacto, tests |
| Review PR | Claude GitHub app (`@claude` dans PR) | Relecture du diff, régressions |
| Arbitrage | Claude Code (CLI) | "Option A vs B ?" |

---

## 5. Environnements

| Branche | Environnement | URL | Déploiement |
|---|---|---|---|
| `main` | Production | `house.jammin-dev.com` | Auto (GitHub Actions, runner self-hosted) |
| `feature/*` | Local | `localhost:8001` | Manuel (`runserver` + `npm run dev`) |

Pour valider un changement risqué avant prod : lance localement avec `DJANGO_SETTINGS_MODULE=config.settings.production` (et la DB e2e ou un dump prod sanitisé).

---

## 6. Règles minimales

- **Toujours partir de `main`** pour une feature branch.
- **PRs vers `main`**, jamais ailleurs.
- **1 branche = 1 issue** (sauf hotfix trivial direct sur main).
- **Pas d'estimations**, pas de sprints, pas de standup. La colonne "In Progress" du Kanban GitHub fait office de mémoire courte.
- **Idées futures** → label `idea`, pas de milestone. Tu trieras plus tard.

---

## 7. Ce que ce workflow ne fait pas

- Pas de staging — tu testes localement avant de pusher, ou tu acceptes que `main` soit le terrain de validation rapide.
- Pas de CHANGELOG manuel — `git log --oneline` + titres de PR.
- Pas de roadmap publique.
