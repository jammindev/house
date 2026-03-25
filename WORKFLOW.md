# Workflow de dev solo — house

## Contexte — pourquoi ce workflow

L'application est en place. L'enjeu n'est plus de construire from scratch mais de maintenir, ajuster, corriger et faire évoluer le projet dans la durée — sans perdre le fil de ce qui reste à faire.

Le problème sans workflow : les bugs s'accumulent dans des fichiers `.md` éparpillés, les idées se perdent, les décisions techniques ne sont pas tracées, et chaque session de dev commence par "où j'en étais déjà ?".

L'objectif de ce système : **fluidifier le cycle entre l'idée et le code**. Capturer vite, arbitrer simplement, coder avec Claude, merger proprement. Tout est interconnecté (une feature touche plusieurs apps, un refacto débloque un bug) donc un seul endroit centralise tout, organisé par app et par type.

Le workflow s'appuie sur des outils déjà en place — GitHub (issues, projects, PRs) et Claude (CLI pour coder, GitHub app pour spec et review) — sans rien ajouter d'inutile. C'est une méthode éprouvée pour le dev solo, sans la complexité d'une organisation corporate.

---

## Le principe central : GitHub Issues est ta mémoire externe

Fini le `A_AMELIORER_STYLE.md` et les notes éparpillées. **Tout** passe par GitHub Issues. Une issue = une unité de travail, petite ou grande. C'est simple, ça s'intègre avec Claude GitHub app, et ça te donne un historique naturel.

---

## 1. Labels

Deux axes, combinables :

**Par type** :
| Label | Usage |
|---|---|
| `bug` | Quelque chose qui casse ou se comporte mal |
| `feat` | Nouvelle fonctionnalité |
| `style` | UI/UX, design system, cosmétique |
| `refactor` | Code qui fonctionne mais à revoir |
| `security` | Audit sécu, vulnérabilités, hardening |
| `idea` | Pas encore arbitré, juste capturé |
| `docs` | Documentation technique ou produit |

**Par app** :
`app:tasks` · `app:zones` · `app:electricity` · `app:directory` · `app:equipment` · `app:documents` · `app:stock` · `app:projects` · `app:interactions` · `app:general`

Une issue peut avoir plusieurs labels : `bug` + `app:general`, `feat` + `app:tasks`, etc.

---

## 2. Kanban (GitHub Projects)

Un seul board, 4 colonnes :

```
Inbox  →  Todo  →  In Progress  →  Done
```

| Colonne | Règle |
|---|---|
| **Inbox** | Capture brute, pas encore triée. Tout y atterrit par défaut. |
| **Todo** | Arbitré, prêt à coder. Labels posés, description claire. |
| **In Progress** | Max 2 issues simultanées (WIP limit mental). |
| **Done** | Fermé automatiquement quand la PR merge. |

Les workflows GitHub Projects peuvent automatiser : PR merged → issue liée closed → passe en Done.

---

## 3. Cycle de travail

```
Capture → (Spec) → Code → PR → Merge
```

### Capture
Ouvre une issue avec 2 lignes minimum :
- Ce que ça fait / ce que ça devrait faire
- Contexte (page, app, comment reproduire si bug)

Label `idea` si c'est flou, `bug`/`feat`/`refactor` si c'est tranché. L'issue atterrit en **Inbox**.

### Spec (optionnel — pour les features non triviales)
Mentionne `@claude` dans l'issue avec ta question ou ton approche. Le Claude GitHub app répond directement dans le thread. Ça remplace les sessions orales "valider mes idées" et ça laisse une trace de décision dans l'issue. Tu peux lui demander :
- "Est-ce que cette approche a des problèmes que je n'ai pas vus ?"
- "Quels edge cases gérer en priorité ?"
- "Compare ces deux implémentations possibles"

Une fois la spec alignée, tu passes l'issue en **Todo**.

### Code
Tu ouvres Claude Code. Tu mentionnes le numéro d'issue pour contextualiser (`#42`). Tu travailles sur une branche créée depuis `develop` :

```bash
git checkout develop && git pull
git checkout -b fix/general-theme-logout
```

Convention de nommage : `<type>/<app>-<description-courte>`
```
fix/general-theme-logout       # bug
feat/tasks-delete              # feature
style/card-spacing             # visuel
refactor/core-household-view   # refacto
```

### PR → develop
Quand c'est prêt, ouvre une PR **vers `develop`** (pas `main`) :
1. `Closes #<numéro>` dans la description
2. Titre : `type(app): description` → `fix(general): restore theme on logout`
3. `@claude` dans la PR si tu veux une relecture

Le CI tourne (tests backend + build frontend). Si ça passe, merge → **auto-deploy sur staging** (`staging.house.jammin-dev.com`).

### Validation sur staging
Tu testes sur `staging.house.jammin-dev.com`. Si c'est bon, tu passes à la suite. Si non, tu corriges sur la même branche feature ou directement sur `develop`.

### PR develop → main (mise en prod)
Quand staging est validé (une feature ou un lot) :
1. Ouvre une PR `develop → main`
2. Titre : `release: <description du lot>` ou juste les titres des features
3. Merge → **auto-deploy en production** (`house.jammin-dev.com`)

### Hotfix urgent (bypass staging)
Si un bug critique est en prod, tu peux créer une branche `hotfix/xxx` depuis `main`, merger directement sur `main`, puis reporter le fix sur `develop` (`git cherry-pick` ou merge).

---

## 4. Où Claude intervient

| Moment | Outil | Ce que tu lui demandes |
|---|---|---|
| Capture floue | Claude Code (CLI) | "Est-ce que c'est un bug ou un comportement voulu ?" |
| Spec feature | Claude GitHub app (`@claude` dans issue) | Challenge l'approche, liste les edge cases, propose un plan |
| Coding | Claude Code (CLI) | Implémentation, debug, refacto, tests |
| Review PR | Claude GitHub app (`@claude` dans PR) | Relecture du diff, détection de régressions potentielles |
| Arbitrage technique | Claude Code (CLI) | "Option A vs option B — qu'est-ce que tu recommandes ?" |

---

## 5. Gestion des Parcours

Les Parcours (01→06) sont des regroupements produit, pas des sprints. Utilise les **Milestones GitHub** pour les représenter :
- Milestone = un Parcours
- Les issues liées à ce parcours sont assignées à la milestone
- La milestone se ferme quand toutes les issues sont Done

Ça te donne une vision "où en est le Parcours 06" sans avoir besoin d'un outil externe.

---

## 6. Environnements

| Branche | Environnement | URL | Déploiement |
|---|---|---|---|
| `main` | Production | `house.jammin-dev.com` | Auto via GitHub Actions (push main) |
| `develop` | Staging | `staging.house.jammin-dev.com` | Auto via GitHub Actions (push develop) |
| `feature/*` | Local | `localhost:8001` | Manuel (`runserver`) |

---

## 7. Règles légères

- **1 branche = 1 issue** — pas de branches fourre-tout
- **Toujours partir de `develop`** pour créer une feature branch
- **PRs vers `develop`**, jamais directement vers `main`
- **`main` ne reçoit que des PRs depuis `develop`** (ou hotfix)
- **Inbox ≠ Todo** — ne passe en Todo que ce que tu es prêt à faire sous 2 semaines
- **Pas d'estimations** — inutile seul, source de frustration
- **Idées futures** → label `idea` + Inbox, pas de milestone. Tu trieras plus tard.

---

## Ce que ce workflow ne fait PAS (volontairement)

- Pas de Sprints / vélocité — trop lourd pour solo
- Pas de roadmap publique
- Pas de CHANGELOG manuel — le titre des PRs suffit, `git log --oneline` fait office de changelog
- Pas de standup / rituel — la colonne "In Progress" est ton standup
