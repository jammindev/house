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
`/app/money/transactions/:id`, `/app/money/analysis`, `/app/money/budgets/:id`,
`/app/money/recurring`, `/app/money/reports`.

Les deux dernières ont rejoint la famille en juillet 2026 ; `/app/budget/recurring`
et `/app/budget/reports` redirigent via `PreserveQueryRedirect`, qui conserve la
query string pour la même raison que `LegacyMoneyRedirect`. Un test tient la
règle côté serveur : `agent/tests/test_registry.py::test_the_money_family_links_stay_inside_the_money_module`
refuse tout `url_template` de la famille argent qui ne commence pas par
`/app/money` — une redirection rattrape un ancien lien, elle ne justifie pas d'en
produire de nouveaux.

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

## L'audit de cohérence (juillet 2026)

Un passage complet sur les trois apps (`banking`, `budget`, `interactions`) et les
quatre features front. L'architecture tenait ; les défauts étaient tous **aux
jointures** — là où deux modules répondent à la même question sans passer par la
même fonction. Les conclusions valent au-delà de l'argent.

### Un compteur ne peut pas avoir deux définitions

« Ce mois-ci » était borné dans le fuseau du foyer par `budget.aggregations` et en
UTC par `interactions.views`. Deux heures d'écart — mais placées exactement sur la
frontière d'un mois, donc sur un budget. Cliquer sur « 340 € / 400 € » pouvait
ouvrir une page annonçant 352 €.

`apps/core/timezones.py` est désormais le seul endroit qui sait ce qu'est un mois,
une journée, ou « aujourd'hui » chez un foyer. Six copies locales du helper de
fuseau (dont deux correctes, quatre approximatives) sont devenues des alias.
Côté front, `toLocalISODate` / `todayISO` remplacent les
`toISOString().slice(0, 10)` — qui décalaient les quatre périodes d'un jour aux
deux bouts et proposaient « hier » comme date du jour entre minuit et 2 h.

Régressions : `interactions/tests/test_period_bounds.py`,
`ui/src/features/expenses/period.test.ts`.

### Un cache périmé est un compteur qui ment

Huit mutations touchent à l'argent, chacune déclarait sa propre liste
d'invalidations, et cinq en oubliaient au moins une. La pire : **importer un
relevé** n'invalidait que `banking`, alors que c'est le moment où les compteurs de
conformité passent de zéro à cent.

`useInvalidateMoney` remplace les huit listes. Invalider trop large coûte quelques
requêtes ; invalider trop étroit coûte la confiance dans les chiffres — et le bug
est invisible en revue, parce que chaque liste prise isolément a l'air réfléchie.

### La parité entre catalogues ne voit pas une clé écrasée

Le dialogue « dépense en espèces » (lot 4) a réutilisé le namespace
`banking.cash.*` et effacé les douze clés du dialogue « retirer vers les espèces ».
En production, le journal affichait `banking.cash.action` sur chaque ligne
sortante, et le dialogue de retrait portait le titre du dialogue de dépense.

Le contrôle de parité entre les quatre langues était vert : la clé manquait
**partout**. Comparer les langues entre elles ne suffit pas — il faut comparer le
**code** au catalogue. C'est ce que fait `ui/src/locales/keys.test.ts`, désormais
lancé par la CI (les tests unitaires du front n'étaient exécutés par personne).

Le retrait vit maintenant sous `banking.withdraw.*`.

### Le journal a un filtre « À traiter »

Le marqueur par ligne (#413) disait ce qu'il restait à ranger sans qu'on puisse
s'y rendre. `?allocation=todo` passe par `detectors.pending_outflows`, la même
fonction que les compteurs du Contrôle : une file dont le nombre contredirait le
badge ferait perdre leur crédit aux deux.

### Détacher est un geste, plus un effet de bord

L'endpoint `DELETE /transactions/{id}/unlink/{interaction_id}/` n'avait aucun
appelant. En cherchant où le brancher, on a trouvé pourquoi il était inutile : le
service le faisait déjà **tout seul**, au mauvais moment.

`set_allocations` détachait tout ce qu'il ne possède pas. Concrètement : 150 € chez
Leroy Merlin, dont 90 € déjà saisis comme achat de projet et rapprochés à la main ;
éditer les 60 € restants dé-rapprochait les 90 €. L'écart « dépense non rapprochée »
resurgissait sur une dépense que l'utilisateur avait résolue, et comme l'éditeur
chargeait *toutes* les ventilations dans son brouillon, enregistrer recréait une
dépense `kind='bank'` pour les mêmes 90 € — 180 € de dépenses sur 150 € d'argent,
et le chantier facturé deux fois pour le même carrelage.

Trois conséquences, symétriques de la règle de propriété du lot 3 :

- **la portée de l'éditeur s'arrête à ce qu'il a créé.** Il supprime ses lignes
  `kind='bank'`, et ne touche à rien d'autre — ni suppression, ni détachement ;
- **le montant rattaché est un plancher.** `set_allocations` le compte contre
  l'`outflow`, donc renvoyer la ligne rattachée dans le payload est un **400** au
  lieu d'un doublement silencieux ;
- **le geste existe** : le bloc « Dépenses déjà rattachées » de l'`AllocationDialog`
  les affiche en lecture seule avec un bouton « Détacher », qui appelle l'endpoint.

Régression : `banking/tests/test_allocation_axes.py::TestSavingASplitNeverUndoesAReconciliation`.

### « 340 € / 400 € » : deux chiffres, jamais un filtre

Une dépense jamais rapprochée gonfle une enveloppe sans qu'aucune ligne de relevé
ne l'atteste. Chaque ligne de l'aperçu porte donc `spent_attested` et
`spent_pending` **en plus** de `spent`, calculés en un seul `GROUP BY` (un
`Sum(filter=…)` conditionnel — l'aperçu est rechargé à chaque visite de l'onglet).

Ce qui n'a **pas** été fait, et pourquoi : filtrer `bank_transaction__isnull=False`
pour ne compter que le prouvé. Une dépense saisie hier est réelle même si le relevé
de fin de mois n'est pas importé ; le compteur reculerait au fil du mois pour
remonter d'un coup à l'import. **Un plafond qui recule est pire qu'un plafond
incertain.** Le plafond mesure donc toujours le total, et la barre dit la
différence en deux nuances de la même couleur — une autre teinte laisserait croire
à une autre nature de dépense.

`spent_pending` est calculé **par différence**, jamais par une seconde somme : deux
agrégats indépendants finissent par se contredire d'un centime d'arrondi, et un
total qui ne se recompose pas ne se lit pas. Régression :
`budget/tests/test_api_budget.py::TestWhatTheStatementAttests`.

### Une dépense dit si le relevé la justifie — et laquelle

Le marqueur du journal bancaire répondait « où en est cette **ligne** ». Il
manquait la même question depuis l'autre rive : « cette **dépense**, la banque
l'a-t-elle vue passer ? ». C'est `reconciliation_state`, servi par
`InteractionSerializer`, rendu par `ui/src/features/money/ReconciliationBadge.tsx`,
et posé partout où une dépense s'affiche — onglet Dépenses, journal des
interactions, détail d'une interaction, onglet Dépenses d'un projet.

Cinq états, miroir exact de `AllocationProgress` : `''` (pas une dépense),
`attested`, `cash`, `pending`, `out_of_scope`.

- **Le verdict est calculé côté serveur** (`banking.queries.reconciliation_state`),
  jamais dérivé de `bank_transaction === null` côté client. C'est la même règle que
  le marqueur bancaire, et pour la même raison : il dépend de la fenêtre de
  conformité. La première version du badge (lot 7 du parcours 26) lisait la FK et
  affichait « en attente de rapprochement » **en rouge** sur des dépenses
  antérieures au premier relevé — que le Contrôle, lui, ne réclamait pas. Deux
  écrans en désaccord sur le même fait. Régression :
  `banking/tests/test_expense_marker.py::TestTheMarkerAgreesWithTheControl`.
- **`cash` ne se déduit pas de `reconciled_by`.** L'ancienne règle
  (`reconciled_by === ''` → espèces) était morte : `create_bank_expense_interaction`
  écrit `manual` sur *tous* les rattachements, y compris ceux nés d'une dépense en
  liquide, et détacher remet la FK à `null` avant qu'on arrive au test. Le
  discriminant est le **type du compte** de la ligne — un fait, pas une trace.
- **Le badge mène à l'opération.** « Rapprochée » sans pouvoir aller voir *à quoi*
  reste une affirmation invérifiable. La destination est une vraie page,
  `/app/money/transactions/:id`, et non le journal filtré : sur un relevé de
  160 lignes, « elle est quelque part dans cette liste » ne vérifie rien. Ce que
  cette page montre et que le journal ne peut pas : les **autres** ventilations de
  la même opération — arriver là depuis une dépense de 90 €, c'est découvrir que la
  ligne en faisait 150.

Coût : trois requêtes fixes par réponse (la fenêtre du foyer), la ligne et son
compte arrivant par `select_related`. Borné par
`test_expense_marker.py::TestItStaysCheap`, qui compare cinq dépenses à quarante
plutôt que de plafonner le total de la page — la liste des interactions a un N+1
antérieur (documents, contacts, structures, équipements : sept requêtes par ligne)
qu'une borne globale mesurerait à la place.

### Reste ouvert

Un seul point, et il attend de l'usage plutôt qu'un arbitrage : les **suggestions
de budget apprises** (`label_norm` + fournisseur + historique des budgets). C'est
le vrai levier sur l'effort de rangement, mais l'apprendre demande un mois réel de
données — le construire avant, c'est inventer les motifs qu'on croit avoir.
