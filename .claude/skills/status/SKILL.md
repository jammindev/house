---
name: status
description: Point d'avancement rapide du projet house — travail en cours (branche + WIP), PRs ouvertes en attente, livraisons récentes, parcours/lots restants, dette prioritaire avant MVP. Synthétise l'état GitHub (issues, PRs) et git en un rapport court et actionnable. Utiliser quand l'utilisateur veut « faire un point », un état des lieux, savoir où en est le projet, ce qui reste à faire ou ce qui est en cours.
allowed-tools: Bash, Read
---

# Status — point d'avancement du projet

Produis un **état des lieux court et actionnable** du projet house. Pas un
inventaire exhaustif : le but est que l'utilisateur sache en 30 secondes **où en
est le projet, ce qui est en cours, et quoi faire ensuite**.

Le suivi est sur **GitHub** (org `jammindev`, repo `house`), pas GitLab.

## 1. Collecter (lancer en parallèle)

Exécute ces relevés — regroupe-les en un minimum d'appels `Bash` parallèles.

```bash
# A. Travail en cours : branche + fichiers modifiés (hors .claude/) + commits non mergés
git status -sb | head -1
git status -s | grep -v '.claude/'
git log main..HEAD --oneline 2>/dev/null | head -15

# B. PRs ouvertes (= en attente de review/merge, souvent le point chaud)
gh pr list --state open --limit 30 \
  --json number,title,headRefName,isDraft,reviewDecision \
  --template '{{range .}}#{{.number}} {{.title}} ({{.headRefName}}){{if .isDraft}} DRAFT{{end}} [{{.reviewDecision}}]{{"\n"}}{{end}}'

# C. Livraisons récentes (contexte : ce qui vient d'être fait)
gh pr list --state merged --limit 15 \
  --json number,title,mergedAt \
  --template '{{range .}}#{{.number}} {{.title}} ({{.mergedAt}}){{"\n"}}{{end}}'

# D. Issues ouvertes (backlog + chantiers en cours)
gh issue list --state open --limit 80 \
  --json number,title,labels \
  --template '{{range .}}#{{.number}} {{.title}}{{range .labels}} [{{.name}}]{{end}}{{"\n"}}{{end}}'
```

Si utile pour situer un chantier, lis le doc de parcours concerné dans
`docs/parcours/` (ne le fais que si l'utilisateur creuse un point précis).

## 2. Interpréter

- **Branche courante ≠ main + fichiers modifiés** → il y a du **WIP non commité**.
  Devine le chantier depuis les fichiers touchés et rapproche-le d'une issue
  ouverte (ex : `apps/stock/*` modifié + issue stock ouverte). Signale si rien
  n'est encore commité.
- **PRs ouvertes** = le point le plus chaud : elles attendent une action
  (review, correction CI, merge). Toujours les remonter en tête, avec ce qui
  les bloque si visible (`reviewDecision`, DRAFT).
- **Parcours / lots** : les issues sont nommées `Parcours NN — Lot X : …`.
  Groupe-les par parcours pour montrer ce qui reste d'un chantier structuré, et
  déduis quels lots sont livrés (issues closes / PRs mergées) vs restants.
- **Dette / MVP** : repère les labels `security`, l'issue chapeau d'audit MVP
  (#58 historiquement), et les PRs auth en attente — ce sont les bloqueurs
  d'ouverture aux utilisateurs.
- **Idées V2** (label `idea`) : à mentionner comme backlog long terme, pas comme
  travail actif — ne pas noyer le rapport avec.

## 3. Restituer

Un rapport structuré, dense, en français. Sections dans cet ordre (**omets une
section vide**) :

1. **🔨 En cours** — branche courante + WIP non commité, rattaché à une issue.
   La première chose que l'utilisateur veut savoir.
2. **🔀 PRs en attente** — ce qui bloque, action attendue. Omettre si aucune.
3. **✅ Livré récemment** — 5-8 dernières PRs mergées, en une ligne chacune.
4. **🚧 Chantiers ouverts** — parcours/lots restants, groupés par parcours.
5. **🔒 Dette prioritaire (MVP)** — sécurité/auth bloquant l'ouverture.
6. **👉 Prochaines actions** — 2-3 recommandations concrètes, priorisées.

Règles de style :
- Tables ou puces courtes, jamais de paragraphes longs.
- Toujours citer les **numéros d'issue/PR** (cliquables, actionnables).
- Ne liste pas les ~30 modules ni tout le backlog : synthétise, hiérarchise.
- Termine par les **prochaines actions**, pas par un inventaire.
- Ne modifie rien : ce skill est en lecture seule.
