# Module — money (la coque « Argent »)

> Rôle : réunir **comptes, dépenses et budgets** dans un seul module à onglets, et
> mettre devant eux les deux écrans qui manquaient — **Contrôle** et **À ranger**.
>
> Parcours : `docs/parcours/PARCOURS_26_CONFORMITE_ARGENT.md` (lot 2).
> Backend consommé : [banking.md](./banking.md) (conformité), [budget.md](./budget.md),
> [interactions.md](./interactions.md).

## Pourquoi un seul module

Comptes, dépenses et budgets étaient trois entrées de sidebar. Ce sont **trois
lectures d'un même fait** : ce qui est sorti du compte. Les séparer obligeait
l'utilisateur à faire lui-même le lien — et rendait invisible la question qui
compte avant toutes les autres :

> « Qu'est-ce qu'il me reste à faire pour que mes chiffres soient justes ? »

D'où l'ordre des onglets : **Contrôle**, **À ranger**, puis Comptes, Dépenses,
Budgets. La conformité passe devant le reporting.

## Structure

```
ui/src/features/money/
  MoneyPage.tsx        # la coque : TabShell + badges
  keys.ts              # query keys + clés de détecteurs (sans dépendance sortante)
  hooks.ts             # conformité : summary, groupe, arbitrer, révoquer
  CompliancePanel.tsx  # onglet Contrôle
  PendingQueue.tsx     # onglet À ranger
  PendingCard.tsx      # une opération à ranger
  WaiverDialog.tsx     # arbitrer (motif requis)
  AccountsPanel.tsx    # ex-banking/BankingPage
  ExpensesPanel.tsx    # ex-expenses/ExpensesPage
  BudgetsPanel.tsx     # ex-budget/BudgetPage
  AnalysisPage.tsx     # sous-page : analyse fine des dépenses par budget
  BudgetDetailPage.tsx # sous-page : de quoi un budget est fait
  BudgetShareChart.tsx # anneau de répartition + légende chiffrée
```

Les trois panneaux sont les anciennes pages, **`PageHeader` en moins** : la coque
porte le titre. Leur contenu n'a pas changé, et leurs actions restent dans le
panneau — elles connaissent l'état d'édition local (compte courant, import en
cours) qu'il aurait fallu remonter sans raison.

## Décisions de conception

### `keys.ts` séparé de `hooks.ts`

`banking/hooks.ts` doit invalider la conformité après une ventilation, et
`money/hooks.ts` importe déjà `bankingKeys`. Un import direct créerait un cycle.
Un module de clés **sans dépendance sortante** le casse, sans dupliquer la chaîne
`'compliance'` dans deux fichiers où elle finirait par diverger d'un caractère.

### Les pastilles de budget ne s'affichent pas sur une ligne partielle

L'enregistrement d'une ventilation est un **remplacement complet** (`PUT`, un
« set »). Imputer d'un clic une ligne déjà partagée écraserait donc le travail
déjà fait. Sur une ligne partielle, le seul chemin est le dialog, qui part de
l'existant — et la sélection multiple ne propose que des lignes entièrement non
ventilées, pour la même raison.

### « Plus tard » n'écrit rien

Quatre issues sur une carte, et aucune cinquième qui ferait disparaître la ligne :
une pastille, un découpage, un arbitrage motivé, ou un report. Le report est
volontairement **local à la session** — la ligne n'est pas résolue, elle revient.

### Un groupe à zéro reste visible

Coché, pas masqué. C'est ce qui distingue « contrôlé et conforme » de « pas encore
contrôlé » ; une liste vide serait indistinguable d'un détecteur en panne.

### Les prérequis bloquants passent en tête

Un compte sans solde d'ouverture n'a pas de fenêtre de conformité : ses dépendants
ne sont pas « conformes », ils ne sont **pas évaluables**. Le panneau les trie par
sévérité (`blocker` d'abord) et affiche `blocked_by` pour expliquer pourquoi un
contrôle ne porte peut-être pas sur tout.

### `AllocationDialog` prend un id, plus un objet

Le dialog charge déjà la ventilation courante, qui embarque la ligne. Passer
l'objet en plus obligeait chaque appelant à le détenir — or la file de rangement ne
connaît que des **écarts**, identifiés par un id.

## La fusion des clés de module — ce qu'elle a impliqué

`banking` était **optionnel**, `expenses` et `budget` étaient **core**. La clé
fusionnée `money` doit être core : un foyer ne peut pas désactiver `money` sans
perdre dépenses et budgets, qui n'ont jamais été désactivables.

**Conséquence assumée : les comptes bancaires ne sont plus un opt-in.** C'est
cohérent avec « les relevés sont la source de vérité », mais c'est une décision
produit, pas un effet de bord.

Deux data migrations, parce qu'une configuration stockée qui ne correspond plus à
rien est un orphelin :

- `households.0011` retire `'banking'` des `disabled_modules` existants ;
- `accounts.0014` replie `banking`/`expenses`/`budget` en `money` dans les
  `pinned_modules`, **en préservant la position** du premier des trois — un
  utilisateur qui avait « Dépenses » en tête retrouve « Argent » en tête.

## Navigation

| Ancienne URL | Devient | Onglet |
|---|---|---|
| `/app/banking` | `/app/money?tab=accounts` | Comptes |
| `/app/expenses` | `/app/money?tab=expenses` | Dépenses |
| `/app/budget` | `/app/money?tab=budgets` | Budgets |
| `/app/banking/transactions` | `/app/money/transactions` | *(sous-page)* |

`LegacyMoneyRedirect` (`ui/src/components/`) **préserve la query string** :
l'agent produit `/app/budget?b={id}`
(`apps/budget/apps.py::SearchableSpec.url_template`) et un favori peut porter
n'importe quel paramètre. Les `url_template` de l'agent ont aussi été mis à jour,
pour que les nouveaux liens soient directs plutôt que redirigés.

Le deep link `?tab=` est écrit dans la session **avant** que `TabShell` lise sa
valeur initiale — l'initialiseur d'état du parent s'exécute avant le montage de
l'enfant, ce qui rend le mécanisme fiable plutôt que fragile.

Sous-pages autonomes (avec `BackLink`) : `/app/money/transactions`,
`/app/money/analysis`, `/app/money/budgets/:id`, `/app/budget/recurring`,
`/app/budget/reports`.

`/app/money/analysis` est la **lecture longue** des dépenses (tendance mensuelle
par budget, répartition, fournisseurs, plus grosses dépenses) — le panneau
Budgets ne regarde que le mois en cours. Détail du calcul et de ce qu'il refuse
d'inventer : `docs/MODULES/budget.md`, section « Analyse fine ».

## i18n

Namespace **`money`** (coque, contrôle, file). Le libellé utilisateur de chaque
détecteur vit sous `money.compliance.kinds.<kind>.{title,hint,resolution}` — côté
front, pas en `gettext` backend : ajouter un détecteur ne doit pas imposer un
passage dans quatre `.po`.

Les namespaces `banking`, `expenses`, `budget` restent et leur contenu est réutilisé
tel quel par les panneaux.

⚠️ `expenses.adhoc.actions.add` est passé de « Dépense » à « **Nouvelle dépense** » :
dans la coque, le bouton et l'onglet « Dépenses » avaient des noms accessibles
confusables, ce qui est un problème d'ergonomie avant d'être un problème de test.

## Tests

`e2e/money.spec.ts` couvre ce que la fusion pouvait casser en silence : la coque,
les quatre redirections (dont la préservation de la query string), le deep link,
la sidebar, le panneau Contrôle, et l'identité `ouverts + arbitrés = détectés`
vérifiée directement sur l'API.

Les specs `budget`, `report`, `recurring`, `expense-adhoc`, `expenses-summary` ont
été retargetées sur les nouvelles URLs.
